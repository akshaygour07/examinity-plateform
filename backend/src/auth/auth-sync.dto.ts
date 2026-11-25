import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsIn, IsOptional, IsString, Matches, MaxLength } from "class-validator";

export const REGISTRATION_SOURCES = ["EMAIL", "PHONE", "SOCIAL"] as const;
export type RegistrationSource = (typeof REGISTRATION_SOURCES)[number];

export class AuthSyncDto {
  @ApiPropertyOptional({ example: true, description: "Required on first provisioning. Must be true." })
  @IsOptional()
  @IsBoolean()
  terms_accepted?: boolean;

  @ApiPropertyOptional({
    example: "v1",
    maxLength: 50,
    description: "Must match TERMS_VERSION on first provisioning.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Matches(/^[A-Za-z0-9._-]+$/)
  terms_version?: string;

  @ApiPropertyOptional({ example: "EMAIL", enum: REGISTRATION_SOURCES, description: "Required on first provisioning." })
  @IsOptional()
  @IsString()
  @IsIn(REGISTRATION_SOURCES)
  registration_source?: RegistrationSource;
}
