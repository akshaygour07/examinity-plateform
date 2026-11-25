import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsOptional, IsString, Matches, MaxLength } from "class-validator";

export class UpdatePreferencesDto {
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  transactional_email_enabled?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  marketing_email_enabled?: boolean;

  @ApiPropertyOptional({ example: "en-IN", maxLength: 20 })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/)
  locale?: string;

  @ApiPropertyOptional({ example: "en", maxLength: 10 })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/)
  language?: string;

  @ApiPropertyOptional({ example: "Asia/Kolkata", maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  timezone?: string;
}
