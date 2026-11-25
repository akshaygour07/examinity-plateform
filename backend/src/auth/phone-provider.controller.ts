import { Body, Controller, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { AuditService } from "../audit/audit.service";
import { AuditAction } from "../audit/audit-actions";
import { PhoneOtpDeliveryDto } from "./phone-otp-delivery.dto";
import { PhoneOtpDeliveryService } from "./phone-otp-delivery.service";
import { PhoneProviderGuard } from "./phone-provider.guard";

@ApiTags("Auth0 phone provider")
@ApiBearerAuth()
@UseGuards(PhoneProviderGuard)
@Controller("auth/phone")
export class PhoneProviderController {
  constructor(
    private readonly delivery: PhoneOtpDeliveryService,
    private readonly audit: AuditService,
  ) {}

  @Post("deliver")
  @ApiOperation({
    summary: "Deliver an Auth0-generated OTP over WhatsApp, falling back to SMS",
    description: "Provider callback only. Auth0 retains and verifies the OTP and issues tokens; this endpoint never stores the code.",
  })
  async deliver(@Body() body: PhoneOtpDeliveryDto, @Req() request: Request & { id?: string }) {
    try {
      const result = await this.delivery.deliver(body);
      await this.recordDelivery(request.id, "SUCCESS", result.data.channel);
      return result;
    } catch (error) {
      await this.recordDelivery(request.id, "FAILURE");
      throw error;
    }
  }

  private async recordDelivery(requestId: string | undefined, result: "SUCCESS" | "FAILURE", channel?: string) {
    try {
      await this.audit.record({
        actorUserId: null,
        action: AuditAction.PHONE_OTP_DELIVERY,
        resourceType: "phone_verification",
        resourceId: null,
        requestId: requestId ?? "unknown",
        result,
        metadata: { ...(channel ? { channel } : {}) },
      });
    } catch {
      // A committed Auth0 OTP delivery should not be retried only because audit storage had a transient failure.
    }
  }
}
