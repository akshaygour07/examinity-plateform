import { Module } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { Auth0Guard } from "./auth0.guard";
import { AuditModule } from "../audit/audit.module";
import { PhoneProviderController } from "./phone-provider.controller";
import { PhoneOtpDeliveryService } from "./phone-otp-delivery.service";
import { PhoneProviderGuard } from "./phone-provider.guard";
import { SessionsService } from "../sessions/sessions.service";

@Module({
  imports: [AuditModule],
  controllers: [AuthController, PhoneProviderController],
  providers: [AuthService, Auth0Guard, SessionsService, PhoneOtpDeliveryService, PhoneProviderGuard],
})
export class AuthModule {}
