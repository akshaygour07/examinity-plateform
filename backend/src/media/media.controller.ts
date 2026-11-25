import { Body, Controller, Delete, Get, Headers, Param, ParseUUIDPipe, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiHeader, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Auth0Guard, type AuthenticatedRequest } from "../auth/auth0.guard";
import { AuthorizationGuard } from "../auth/authorization.guard";
import { RequirePermissions } from "../auth/authorization";
import { auditRequest } from "../common/request-context";
import { MediaService } from "./media.service";
import { PresignMediaDto } from "./media.dto";

@ApiTags("media")
@ApiBearerAuth()
@UseGuards(Auth0Guard, AuthorizationGuard)
@Controller("media")
/** Authorized metadata and presigned-URL routes for S3-compatible object storage. */
export class MediaController {
  constructor(private readonly media: MediaService) {}
  @Post("presign")
  @RequirePermissions("media.upload")
  @ApiHeader({ name: "Idempotency-Key", required: true })
  @ApiOperation({ summary: "Create a short-lived S3-compatible upload URL and pending asset" })
  @ApiBody({
    type: PresignMediaDto,
    examples: {
      privatePdf: {
        summary: "Create a private PDF upload (requires configured object storage)",
        value: { original_filename: "sample.pdf", mime_type: "application/pdf", file_size_bytes: 12345, visibility: "PRIVATE" },
      },
      publicImage: {
        summary: "Create a public PNG upload",
        value: { original_filename: "sample.png", mime_type: "image/png", file_size_bytes: 54321, visibility: "PUBLIC" },
      },
    },
  })
  /** Creates a pending media record and returns a short-lived direct-upload URL. */
  presign(@Req() request: AuthenticatedRequest, @Body() body: PresignMediaDto, @Headers("idempotency-key") key?: string) {
    return this.media.presign(request.principal!, body, auditRequest(request), key ?? "");
  }
  @Post(":id/complete")
  @RequirePermissions("media.upload")
  @ApiOperation({ summary: "Validate an uploaded object and mark the asset available" })
  /** Confirms uploaded object details before making a pending asset available through the API. */
  complete(@Req() request: AuthenticatedRequest, @Param("id", new ParseUUIDPipe()) id: string) {
    return this.media.complete(request.principal!, id, auditRequest(request));
  }
  @Get(":id")
  @RequirePermissions("media.read")
  @ApiOperation({ summary: "Get available media metadata after ownership checks" })
  /** Returns metadata only when the caller is authorized to access the asset. */
  get(@Req() request: AuthenticatedRequest, @Param("id", new ParseUUIDPipe()) id: string) {
    return this.media.get(request.principal!, id);
  }
  @Get(":id/download-url")
  @RequirePermissions("media.download")
  @ApiOperation({ summary: "Generate a short-lived authorized media download URL" })
  /** Returns a time-limited download URL after applying asset ownership and visibility rules. */
  download(@Req() request: AuthenticatedRequest, @Param("id", new ParseUUIDPipe()) id: string) {
    return this.media.downloadUrl(request.principal!, id);
  }
  @Delete(":id")
  @RequirePermissions("media.delete")
  @ApiOperation({ summary: "Soft-delete a media asset; storage lifecycle cleanup is an ops task" })
  /** Marks the asset deleted and audits the action; physical object cleanup is handled operationally. */
  delete(@Req() request: AuthenticatedRequest, @Param("id", new ParseUUIDPipe()) id: string) {
    return this.media.delete(request.principal!, id, auditRequest(request));
  }
}
