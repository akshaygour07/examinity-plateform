import { IsNotEmpty, IsUUID, IsDateString, IsString, MaxLength, MinLength, IsOptional } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class AssignRoleDto {
  @ApiProperty({ example: "00000000-0000-4000-8000-000000000002", description: "ID of an existing seeded or configured role." })
  @IsUUID()
  role_id!: string;
  @ApiPropertyOptional({ example: "2026-10-24T09:00:00.000Z", format: "date-time" })
  @IsOptional()
  @IsDateString()
  starts_at?: string;
  @ApiPropertyOptional({ example: "2027-10-24T09:00:00.000Z", format: "date-time" })
  @IsOptional()
  @IsDateString()
  ends_at?: string;

  @ApiProperty({ example: "Approved by the support lead", minLength: 5, maxLength: 500 })
  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  @MaxLength(500)
  reason!: string;
}

export class RevokeRoleDto {
  @ApiProperty({ example: "Role no longer required for this account", minLength: 5, maxLength: 500 })
  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  @MaxLength(500)
  reason!: string;
}
