import { CanActivate, ExecutionContext, Injectable, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { timingSafeEqual } from "node:crypto";
import type { Request } from "express";

@Injectable()
export class PhoneProviderGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const configuredSecret = process.env.PHONE_PROVIDER_API_SECRET;
    if (!configuredSecret || configuredSecret.length < 32)
      throw new ServiceUnavailableException({
        code: "phone_delivery_unavailable",
        message: "Phone verification delivery is not configured.",
      });
    const request = context.switchToHttp().getRequest<Request>();
    const [scheme, candidate = ""] = (request.headers.authorization ?? "").split(" ");
    const expected = Buffer.from(configuredSecret);
    const received = Buffer.from(scheme?.toLowerCase() === "bearer" ? candidate : "");
    if (expected.length !== received.length || !timingSafeEqual(expected, received))
      throw new UnauthorizedException({ code: "phone_provider_unauthorized", message: "The phone delivery provider is not authorized." });
    return true;
  }
}
