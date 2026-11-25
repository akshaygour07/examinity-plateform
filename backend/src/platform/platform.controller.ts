import { BadRequestException, Body, Controller, Get, Param, Patch, Put, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { Auth0Guard, type AuthenticatedRequest } from "../auth/auth0.guard";
import { AuthorizationGuard } from "../auth/authorization.guard";
import { RequirePermissions } from "../auth/authorization";
import { auditRequest } from "../common/request-context";
import { PlatformService } from "./platform.service";
import { PutConfigurationDto, UpdateConfigurationStatusDto } from "./configuration.dto";
import { PutFeatureFlagDto, UpdateFeatureFlagStatusDto } from "./feature-flag.dto";
import { PageQueryDto } from "../common/page-query.dto";

@ApiTags("platform configuration")
@ApiBearerAuth()
@UseGuards(Auth0Guard, AuthorizationGuard)
@Controller()
/** Administrative routes for allowlisted platform settings and registered feature flags (D4, D5, D6). */
export class PlatformController {
  constructor(private readonly platform: PlatformService) {}

  // ─── Platform Settings ─────────────────────────────────────────────────────

  @Get(["configurations", "admin/settings"])
  @RequirePermissions("admin.settings.view")
  @ApiQuery({ name: "page", required: false })
  @ApiQuery({ name: "page_size", required: false, maximum: 100 })
  @ApiOperation({
    summary: "List ACTIVE platform settings",
    description:
      "Returns paginated ACTIVE settings grouped by category. " +
      "Sensitive setting values (is_sensitive=true) are redacted in the response (D4). " +
      "Requires admin.settings.view permission.",
  })
  /** Lists ACTIVE settings; sensitive values are redacted (D4). */
  listConfigurations(@Query() query: PageQueryDto) {
    return this.platform.listConfigurations(query);
  }

  @Get(["configurations/:key", "admin/settings/:key"])
  @RequirePermissions("admin.settings.view")
  @ApiOperation({
    summary: "Read one platform setting by key",
    description: "Sensitive values are redacted. Requires admin.settings.view.",
  })
  /** Reads one ACTIVE setting whose key is registered in the approved catalogue. */
  getConfiguration(@Param("key") key: string) {
    return this.platform.getConfiguration(key);
  }

  @Patch("admin/settings/:key")
  @RequirePermissions("admin.settings.update")
  @ApiOperation({
    summary: "Update an approved platform setting (D4, D6)",
    description:
      "Requires admin.settings.update. A mandatory reason is required. " +
      "Rejected if is_editable=false or status=INACTIVE. Enforces optimistic locking via expected_version. " +
      "Actual secrets must never be stored in this table — use a secrets manager.",
  })
  @ApiBody({
    type: PutConfigurationDto,
    examples: {
      updateDefaultLocale: {
        summary: "Update default locale (supply the key's current version)",
        value: { value: "en-IN", expected_version: 1, reason: "Changing platform default locale to en-IN per stakeholder request." },
      },
      updateSessionTimeout: {
        summary: "Update session timeout policy",
        value: {
          value: { absolute_seconds: 28800, inactivity_seconds: 900 },
          expected_version: 1,
          reason: "Reducing Admin Console inactivity timeout to 15 minutes per security policy.",
        },
      },
    },
  })
  patchAdminSetting(@Req() request: AuthenticatedRequest, @Param("key") key: string, @Body() body: PutConfigurationDto) {
    if (!body.reason?.trim())
      throw new BadRequestException({ code: "change_reason_required", message: "A reason is required for admin setting changes." });
    return this.platform.putConfiguration(request.principal!, key, body, auditRequest(request));
  }

  @Patch("admin/settings/:key/status")
  @RequirePermissions("admin.settings.update")
  @ApiOperation({ summary: "Activate or deactivate a setting definition with optimistic locking (D4)" })
  updateAdminSettingStatus(@Req() request: AuthenticatedRequest, @Param("key") key: string, @Body() body: UpdateConfigurationStatusDto) {
    return this.platform.setConfigurationStatus(request.principal!, key, body, auditRequest(request));
  }

  /** Legacy PUT — kept for backward compatibility; prefer PATCH /admin/settings/:key for new clients. */
  @Put("configurations/:key")
  @RequirePermissions("admin.settings.update")
  @ApiOperation({ summary: "Create/update an allowlisted setting with optimistic concurrency (legacy PUT)" })
  @ApiBody({
    type: PutConfigurationDto,
    examples: {
      updateDefaultLocale: {
        summary: "Update default_locale",
        value: { value: "en-IN", expected_version: 1 },
      },
    },
  })
  putConfiguration(@Req() request: AuthenticatedRequest, @Param("key") key: string, @Body() body: PutConfigurationDto) {
    if (!body.reason?.trim())
      throw new BadRequestException({ code: "change_reason_required", message: "A reason is required for setting changes." });
    return this.platform.putConfiguration(request.principal!, key, body, auditRequest(request));
  }

  // ─── Feature Flags ─────────────────────────────────────────────────────────

  @Get(["feature-flags", "admin/feature-flags"])
  @RequirePermissions("admin.feature_flags.view")
  @ApiQuery({ name: "page", required: false })
  @ApiQuery({ name: "page_size", required: false, maximum: 100 })
  @ApiOperation({
    summary: "List registered feature flags",
    description:
      "Returns all flags with their effective_enabled state. " +
      "INACTIVE flags always report effective_enabled=false regardless of the stored enabled value (D5). " +
      "Requires admin.feature_flags.view.",
  })
  flags(@Query() query: PageQueryDto) {
    return this.platform.flags(query);
  }

  @Get(["feature-flags/:key", "admin/feature-flags/:key"])
  @RequirePermissions("admin.feature_flags.view")
  @ApiOperation({ summary: "Read one registered feature flag", description: "Requires admin.feature_flags.view." })
  getFlag(@Param("key") key: string) {
    return this.platform.getFlag(key);
  }

  @Patch("admin/feature-flags/:key")
  @RequirePermissions("admin.feature_flags.update")
  @ApiOperation({
    summary: "Update a feature flag (D5)",
    description:
      "Requires admin.feature_flags.update. expected_version is mandatory for optimistic locking. " +
      "A reason should be supplied for audit trail. " +
      "INACTIVE flags cannot be toggled — a SUPER_ADMIN must reactivate the flag first.",
  })
  @ApiBody({
    type: PutFeatureFlagDto,
    examples: {
      enable: {
        summary: "Enable a feature flag",
        value: { enabled: true, expected_version: 1, reason: "Enabling new dashboard for all users per release plan." },
      },
      disable: {
        summary: "Disable a feature flag",
        value: { enabled: false, expected_version: 2, reason: "Disabling feature temporarily due to reported issue." },
      },
    },
  })
  patchFlag(@Req() request: AuthenticatedRequest, @Param("key") key: string, @Body() body: PutFeatureFlagDto) {
    if (!body.reason?.trim())
      throw new BadRequestException({ code: "change_reason_required", message: "A reason is required for feature flag changes." });
    if (body.expected_version === undefined)
      throw new BadRequestException({
        code: "expected_version_required",
        message: "expected_version is required for admin feature flag changes to prevent concurrent overwrites (D5).",
      });
    return this.platform.putFlag(request.principal!, key, body, auditRequest(request));
  }

  @Patch("admin/feature-flags/:key/status")
  @RequirePermissions("admin.feature_flags.update")
  @ApiOperation({ summary: "Activate or deactivate a feature flag with optimistic locking (D5)" })
  updateFeatureFlagStatus(@Req() request: AuthenticatedRequest, @Param("key") key: string, @Body() body: UpdateFeatureFlagStatusDto) {
    return this.platform.setFeatureFlagStatus(request.principal!, key, body, auditRequest(request));
  }

  /** Legacy PUT — kept for backward compatibility; prefer PATCH /admin/feature-flags/:key for new clients. */
  @Put("feature-flags/:key")
  @RequirePermissions("admin.feature_flags.update")
  @ApiOperation({ summary: "Change a registered feature flag (legacy PUT)" })
  @ApiBody({
    type: PutFeatureFlagDto,
    examples: {
      enable: { summary: "Enable the flag", value: { enabled: true } },
      disable: { summary: "Disable the flag", value: { enabled: false } },
    },
  })
  putFlag(@Req() request: AuthenticatedRequest, @Param("key") key: string, @Body() body: PutFeatureFlagDto) {
    if (!body.reason?.trim())
      throw new BadRequestException({ code: "change_reason_required", message: "A reason is required for feature flag changes." });
    if (body.expected_version === undefined)
      throw new BadRequestException({
        code: "expected_version_required",
        message: "expected_version is required for feature flag changes.",
      });
    return this.platform.putFlag(request.principal!, key, body, auditRequest(request));
  }
}
