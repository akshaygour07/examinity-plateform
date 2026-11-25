import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { randomUUID, createHash } from "node:crypto";
import { PrismaService } from "../database/prisma.service";
import { AuditService } from "../audit/audit.service";
import { AuditAction } from "../audit/audit-actions";
import type { InternalPrincipal } from "../auth/auth0.guard";
import type { AuditInput } from "../audit/audit.service";
import { PresignMediaDto } from "./media.dto";

type RequestAudit = Pick<AuditInput, "requestId" | "correlationId" | "userAgent" | "ipAddress">;
const safeName = (value: string) =>
  value
    .replace(/[\\/\x00-\x1f\x7f]/g, "_")
    .replace(/^\.+$/, "file")
    .slice(0, 255) || "file";
/** Detects supported media types from file signatures instead of trusting a client MIME header. */
export function detectMediaMimeType(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && bytes.slice(0, 8).join(",") === "137,80,78,71,13,10,26,10") return "image/png";
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP")
    return "image/webp";
  if (bytes.length >= 5 && String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-") return "application/pdf";
  return null;
}

@Injectable()
/** Enforces media ownership, object validation, presigned access and auditable soft deletion. */
export class MediaService {
  private readonly logger = new Logger(MediaService.name);
  private client?: S3Client;
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private localStorageEnabled() {
    return (process.env.STORAGE_ENDPOINT ?? "").toLowerCase() === "local";
  }

  private storage() {
    if (this.localStorageEnabled()) return { client: undefined, bucket: "local-demo" };
    const {
      STORAGE_ENDPOINT: endpoint,
      STORAGE_BUCKET: bucket,
      STORAGE_ACCESS_KEY_ID: accessKeyId,
      STORAGE_SECRET_ACCESS_KEY: secretAccessKey,
    } = process.env;
    if (!endpoint || !bucket || !accessKeyId || !secretAccessKey)
      throw new ServiceUnavailableException({ code: "media_storage_not_configured", message: "Media storage is not configured." });
    this.client ??= new S3Client({
      endpoint,
      region: process.env.STORAGE_REGION ?? "auto",
      forcePathStyle: true,
      credentials: { accessKeyId, secretAccessKey },
    });
    return { client: this.client, bucket };
  }

  private async uploadEnabled() {
    const flag = await this.prisma.featureFlag.findUnique({ where: { flagKey: "media_upload_enabled" }, select: { enabled: true } });
    if (!flag?.enabled) throw new ConflictException({ code: "media_upload_disabled", message: "Media uploads are currently disabled." });
  }

  /** Creates an idempotent pending upload and short-lived storage URL after validating metadata. */
  async presign(actor: InternalPrincipal, dto: PresignMediaDto, request: RequestAudit, idempotencyKey: string) {
    if (!/^[A-Za-z0-9._:-]{1,255}$/.test(idempotencyKey))
      throw new ConflictException({ code: "invalid_idempotency_key", message: "A valid Idempotency-Key header is required." });
    await this.uploadEnabled();
    if (dto.visibility === "PUBLIC") {
      const publicFlag = await this.prisma.featureFlag.findUnique({
        where: { flagKey: "public_media_enabled" },
        select: { enabled: true },
      });
      if (!publicFlag?.enabled || !actor.roles.includes("SUPER_ADMIN"))
        throw new ForbiddenException({
          code: "public_media_not_approved",
          message: "Public media is disabled or not approved for this actor.",
        });
    }
    const [maxSize, types] = await Promise.all([
      this.prisma.configuration.findUnique({ where: { configKey: "max_upload_size" }, select: { valueJson: true } }),
      this.prisma.configuration.findUnique({ where: { configKey: "supported_file_types" }, select: { valueJson: true } }),
    ]);
    const maxBytes = Number(maxSize?.valueJson ?? 10) * 1024 * 1024;
    const allowedTypes = Array.isArray(types?.valueJson)
      ? types.valueJson.map(String)
      : ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (dto.file_size_bytes > maxBytes)
      throw new UnprocessableEntityException({ code: "media_file_too_large", message: "The file exceeds the configured upload limit." });
    if (!allowedTypes.includes(dto.mime_type))
      throw new UnprocessableEntityException({ code: "media_type_not_allowed", message: "The file type is not allowed." });
    const storage = this.storage();
    const client = storage.client;
    const bucket = storage.bucket;
    const scope = `media.presign:${actor.id}`;
    const requestHash = createHash("sha256")
      .update(
        JSON.stringify({
          filename: safeName(dto.original_filename),
          mime_type: dto.mime_type,
          file_size_bytes: dto.file_size_bytes,
          visibility: dto.visibility,
        }),
      )
      .digest("hex");
    const existing = await this.prisma.idempotencyKey.findUnique({ where: { scope_idempotencyKey: { scope, idempotencyKey } } });
    if (existing) return this.replayPresign(existing, requestHash, client, bucket);
    const id = randomUUID();
    const objectKey = `uploads/${id}`;
    try {
      const uploadUrl = client
        ? await getSignedUrl(
            client,
            new PutObjectCommand({
              Bucket: bucket,
              Key: objectKey,
              ContentType: dto.mime_type,
              ContentLength: dto.file_size_bytes,
            }),
            { expiresIn: 300 },
          )
        : `local://${objectKey}`;
      await this.prisma.$transaction(async (tx) => {
        await tx.idempotencyKey.create({
          data: {
            scope,
            idempotencyKey,
            requestHash,
            responseStatus: 201,
            responseJson: { media_id: id, object_key: objectKey },
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
        });
        await tx.mediaAsset.create({
          data: {
            id,
            objectKey,
            originalFilename: safeName(dto.original_filename),
            mimeType: dto.mime_type,
            fileSizeBytes: BigInt(dto.file_size_bytes),
            storageProvider: client ? "s3-compatible" : "local",
            status: "PENDING",
            visibility: dto.visibility,
            uploadedBy: actor.id,
          },
        });
        await this.audit.record(
          {
            actorUserId: actor.id,
            action: AuditAction.MEDIA_UPLOAD_REQUESTED,
            resourceType: "media_asset",
            resourceId: id,
            ...request,
            result: "SUCCESS",
            metadata: { mime_type: dto.mime_type, file_size_bytes: dto.file_size_bytes, visibility: dto.visibility },
          },
          tx,
        );
      });
      return {
        data: {
          media_id: id,
          upload_url: uploadUrl,
          method: "PUT",
          expires_in_seconds: 300,
          required_headers: { "Content-Type": dto.mime_type },
        },
      };
    } catch (error) {
      if (
        error instanceof ConflictException ||
        error instanceof UnprocessableEntityException ||
        error instanceof ServiceUnavailableException
      )
        throw error;
      if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
        const winner = await this.prisma.idempotencyKey.findUnique({ where: { scope_idempotencyKey: { scope, idempotencyKey } } });
        if (winner) return this.replayPresign(winner, requestHash, client, bucket);
      }
      this.logger.warn("Media presign operation failed");
      throw new ServiceUnavailableException({ code: "media_storage_unavailable", message: "Media storage is temporarily unavailable." });
    }
  }

  private async replayPresign(
    record: { requestHash: string; expiresAt: Date; responseJson: unknown },
    requestHash: string,
    client: S3Client | undefined,
    bucket: string,
  ) {
    if (record.requestHash !== requestHash)
      throw new ConflictException({
        code: "idempotency_key_reused",
        message: "This Idempotency-Key was already used with a different request.",
      });
    if (record.expiresAt <= new Date())
      throw new ConflictException({ code: "idempotency_key_expired", message: "This Idempotency-Key has expired; send a new key." });
    const payload = record.responseJson as { media_id?: string; object_key?: string } | null;
    if (!payload?.media_id || !payload.object_key)
      throw new ConflictException({
        code: "idempotency_operation_in_progress",
        message: "The original operation has no replayable result.",
      });
    const media = await this.prisma.mediaAsset.findUnique({ where: { id: payload.media_id } });
    if (!media || media.status !== "PENDING")
      throw new ConflictException({
        code: "idempotency_operation_completed",
        message: "The original upload operation is no longer pending.",
      });
    const uploadUrl = client
      ? await getSignedUrl(
          client,
          new PutObjectCommand({
            Bucket: bucket,
            Key: payload.object_key,
            ContentType: media.mimeType,
            ContentLength: Number(media.fileSizeBytes),
          }),
          { expiresIn: 300 },
        )
      : `local://${payload.object_key}`;
    return {
      data: {
        media_id: media.id,
        upload_url: uploadUrl,
        method: "PUT",
        expires_in_seconds: 300,
        required_headers: { "Content-Type": media.mimeType },
      },
    };
  }

  /** Verifies the uploaded object against its pending record before marking it available. */
  async complete(actor: InternalPrincipal, id: string, request: RequestAudit) {
    const asset = await this.prisma.mediaAsset.findUnique({ where: { id } });
    if (!asset) throw new NotFoundException({ code: "media_not_found", message: "The media asset was not found." });
    if (asset.uploadedBy !== actor.id)
      throw new ForbiddenException({ code: "media_owner_required", message: "You cannot complete this media upload." });
    if (asset.status === "AVAILABLE") return { data: { id, status: asset.status, unchanged: true } };
    if (asset.status !== "PENDING")
      throw new ConflictException({ code: "media_upload_not_pending", message: "The media upload is not pending." });
    const { client, bucket } = this.storage();
    if (!client) {
      const updated = await this.prisma.$transaction(async (tx) => {
        const item = await tx.mediaAsset.update({
          where: { id },
          data: { status: "AVAILABLE", checksum: createHash("sha256").update(asset.objectKey).digest("hex") },
        });
        await this.audit.record(
          {
            actorUserId: actor.id,
            action: AuditAction.MEDIA_UPLOADED,
            resourceType: "media_asset",
            resourceId: id,
            ...request,
            result: "SUCCESS",
            metadata: {
              mime_type: item.mimeType,
              file_size_bytes: Number(item.fileSizeBytes),
              visibility: item.visibility,
              storage: "local",
            },
          },
          tx,
        );
        return item;
      });
      return { data: { id: updated.id, status: updated.status } };
    }
    let valid = false;
    let checksum: string | undefined;
    try {
      const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: asset.objectKey }));
      if (
        head.ContentLength === Number(asset.fileSizeBytes) &&
        head.ContentType?.split(";")[0] === asset.mimeType &&
        !!head.ContentLength &&
        head.ContentLength > 0
      ) {
        const object = await client.send(new GetObjectCommand({ Bucket: bucket, Key: asset.objectKey, Range: "bytes=0-31" }));
        const bytes = await object.Body?.transformToByteArray();
        valid = (bytes ? detectMediaMimeType(bytes) : null) === asset.mimeType;
        checksum = head.ChecksumSHA256;
      }
    } catch (error) {
      const statusCode =
        typeof error === "object" && error !== null && "$metadata" in error
          ? (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode
          : undefined;
      if (statusCode !== 404) {
        this.logger.warn("Media object validation could not reach storage");
        throw new ServiceUnavailableException({ code: "media_storage_unavailable", message: "Media storage is temporarily unavailable." });
      }
    }
    if (!valid) {
      await this.prisma.$transaction(async (tx) => {
        await tx.mediaAsset.update({ where: { id }, data: { status: "REJECTED" } });
        await this.audit.record(
          {
            actorUserId: actor.id,
            action: AuditAction.MEDIA_UPLOAD_REJECTED,
            resourceType: "media_asset",
            resourceId: id,
            ...request,
            result: "FAILURE",
            metadata: { reason: "object_validation_failed" },
          },
          tx,
        );
      });
      throw new UnprocessableEntityException({
        code: "media_object_validation_failed",
        message: "The uploaded object is missing or failed content validation.",
      });
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const item = await tx.mediaAsset.update({ where: { id }, data: { status: "AVAILABLE", checksum } });
      await this.audit.record(
        {
          actorUserId: actor.id,
          action: AuditAction.MEDIA_UPLOADED,
          resourceType: "media_asset",
          resourceId: id,
          ...request,
          result: "SUCCESS",
          metadata: { mime_type: item.mimeType, file_size_bytes: Number(item.fileSizeBytes), visibility: item.visibility },
        },
        tx,
      );
      return item;
    });
    return { data: { id: updated.id, status: updated.status } };
  }

  private async authorizedAsset(actor: InternalPrincipal, id: string) {
    const asset = await this.prisma.mediaAsset.findUnique({ where: { id } });
    if (!asset || asset.status !== "AVAILABLE")
      throw new NotFoundException({ code: "media_not_found", message: "The available media asset was not found." });
    if (asset.visibility === "PRIVATE" && asset.uploadedBy !== actor.id && !actor.roles.includes("SUPER_ADMIN"))
      throw new ForbiddenException({ code: "media_owner_required", message: "You are not authorized to access this media asset." });
    return asset;
  }

  async get(actor: InternalPrincipal, id: string) {
    const asset = await this.authorizedAsset(actor, id);
    return {
      data: {
        id: asset.id,
        original_filename: asset.originalFilename,
        mime_type: asset.mimeType,
        file_size_bytes: Number(asset.fileSizeBytes),
        checksum: asset.checksum,
        status: asset.status,
        visibility: asset.visibility,
        uploaded_by: asset.uploadedBy,
        created_at: asset.createdAt,
        updated_at: asset.updatedAt,
      },
    };
  }

  /** Issues a short-lived download URL only after visibility and ownership checks pass. */
  async downloadUrl(actor: InternalPrincipal, id: string) {
    const asset = await this.authorizedAsset(actor, id);
    const { client, bucket } = this.storage();
    if (!client) return { data: { download_url: `local://${asset.objectKey}`, expires_in_seconds: 60 } };
    try {
      const url = await getSignedUrl(
        client,
        new GetObjectCommand({
          Bucket: bucket,
          Key: asset.objectKey,
          ResponseContentDisposition: `attachment; filename="${asset.originalFilename.replace(/["\\\r\n]/g, "_")}"`,
        }),
        { expiresIn: 60 },
      );
      return { data: { download_url: url, expires_in_seconds: 60 } };
    } catch {
      throw new ServiceUnavailableException({ code: "media_storage_unavailable", message: "Media storage is temporarily unavailable." });
    }
  }

  /** Soft-deletes an asset and records the event; object-store cleanup is outside this service. */
  async delete(actor: InternalPrincipal, id: string, request: RequestAudit) {
    return this.prisma.$transaction(async (tx) => {
      const asset = await tx.mediaAsset.findUnique({ where: { id } });
      if (!asset || asset.status === "DELETED")
        throw new NotFoundException({ code: "media_not_found", message: "The media asset was not found." });
      if (asset.uploadedBy !== actor.id && !actor.roles.includes("SUPER_ADMIN"))
        throw new ForbiddenException({ code: "media_owner_required", message: "You are not authorized to delete this media asset." });
      const updated = await tx.mediaAsset.update({ where: { id }, data: { status: "DELETED" } });
      await this.audit.record(
        {
          actorUserId: actor.id,
          action: AuditAction.MEDIA_DELETED,
          resourceType: "media_asset",
          resourceId: id,
          ...request,
          result: "SUCCESS",
          metadata: { visibility: asset.visibility },
        },
        tx,
      );
      return { data: { id: updated.id, status: updated.status } };
    });
  }
}
