import { ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from "@nestjs/common";
import { Prisma } from "../../generated/prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { CreateImportJobDto } from "./dto/create-import-job.dto";

@Injectable()
export class ImportsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateImportJobDto) {
    const media = await this.prisma.mediaAsset.findUnique({ where: { id: dto.fileMediaId } });
    if (!media || media.status !== "AVAILABLE")
      throw new NotFoundException({ code: "import_file_not_found", message: "The uploaded import file is not available." });
    if (
      !["text/csv", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.ms-excel"].includes(
        media.mimeType,
      )
    )
      throw new UnprocessableEntityException({ code: "import_file_type_invalid", message: "Import files must be CSV or XLSX documents." });
    return {
      data: await this.prisma.examImportJob.create({
        data: {
          importType: dto.importType,
          fileMediaId: dto.fileMediaId,
          status: "PENDING",
          totalRows: 0,
          validRows: 0,
        },
      }),
    };
  }
  async get(id: string) {
    const data = await this.prisma.examImportJob.findUnique({ where: { id }, include: { rows: true } });
    if (!data) throw new NotFoundException();
    return { data };
  }
  async errors(id: string) {
    if (!(await this.prisma.examImportJob.findUnique({ where: { id }, select: { id: true } })))
      throw new NotFoundException({ code: "import_job_not_found", message: "The import job was not found." });
    return { data: await this.prisma.examImportRow.findMany({ where: { importJobId: id, validationErrors: { not: Prisma.DbNull } } }) };
  }
  async commit(id: string) {
    const job = await this.prisma.examImportJob.findUnique({ where: { id } });
    if (!job) throw new NotFoundException();
    if (job.status === "COMMITTED") throw new ConflictException({ code: "import_already_committed", message: "Import already committed." });
    if (job.status !== "VALIDATED" || job.totalRows === 0 || job.validRows === 0 || job.invalidRows > 0)
      throw new ConflictException({
        code: "import_not_ready_to_commit",
        message: "Only a fully validated import with at least one valid row and no invalid rows can be committed.",
      });
    return this.prisma.$transaction(async (tx) => {
      const errors = await tx.examImportRow.count({ where: { importJobId: id, validationErrors: { not: Prisma.DbNull } } });
      if (errors > 0)
        throw new ConflictException({
          code: "import_validation_failed",
          message: "Imports containing row validation errors cannot be committed.",
        });
      const update = await tx.examImportJob.updateMany({
        where: { id, status: "VALIDATED" },
        data: { status: "COMMITTED", completedAt: new Date() },
      });
      if (update.count !== 1)
        throw new ConflictException({ code: "import_state_changed", message: "The import job changed state. Reload it before retrying." });
      return { data: await tx.examImportJob.findUniqueOrThrow({ where: { id } }) };
    });
  }
  async queue() {
    return {
      data: {
        imports: await this.prisma.examImportJob.findMany({ where: { status: { in: ["PENDING", "VALIDATED"] } } }),
      },
    };
  }
  async action(id: string, action: string) {
    if (!["submit-review", "approve-review", "verify", "publish", "unpublish", "archive"].includes(action)) throw new NotFoundException();
    // M2 does not yet have the required content-type registry. Do not claim a
    // workflow transition succeeded until a stable content type and state are resolved.
    throw new ConflictException({
      code: "content_workflow_unavailable",
      message: "The content workflow cannot resolve this item to a registered M2 content type.",
    });
  }
}
