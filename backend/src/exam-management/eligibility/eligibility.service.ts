import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
@Injectable()
export class EligibilityService {
  constructor(private readonly prisma: PrismaService) {}
  async adminProfile(cycleId: string) {
    const item = await this.prisma.eligibilityProfile.findUnique({
      where: { examCycleId: cycleId },
      include: { versions: { include: { inputs: true, ruleGroups: { include: { rules: true } } }, orderBy: { versionNumber: "desc" } } },
    });
    if (!item)
      throw new NotFoundException({
        code: "eligibility_profile_not_found",
        message: "No eligibility profile was found for this examination cycle.",
      });
    return { data: item };
  }
  async publicConfig(cycleId: string) {
    const profile = await this.prisma.eligibilityProfile.findUnique({
      where: { examCycleId: cycleId },
      include: {
        versions: { where: { publicationStatus: "PUBLISHED" }, include: { inputs: true }, orderBy: { versionNumber: "desc" }, take: 1 },
      },
    });
    const version = profile?.versions[0];
    if (!profile || !version)
      throw new NotFoundException({
        code: "eligibility_not_found",
        message: "No published eligibility configuration was found for this examination cycle.",
      });
    return { data: { profile: { id: profile.id, name: profile.name, description: profile.description }, version } };
  }
}
