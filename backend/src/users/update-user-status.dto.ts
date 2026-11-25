import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export type SuspensionCategory = "ROUTINE" | "SECURITY" | "FRAUD" | "LEGAL" | "INVESTIGATION";

/** Controlled application status transitions through the shared Module 1 lifecycle. */
export class UpdateUserStatusDto {
  @ApiProperty({ enum: ["ACTIVE", "DISABLED", "SUSPENDED"] })
  @IsIn(["ACTIVE", "DISABLED", "SUSPENDED"])
  status!: "ACTIVE" | "DISABLED" | "SUSPENDED";

  @ApiProperty({ minLength: 5, maxLength: 1000, description: "Mandatory reason for the account status change." })
  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  @MaxLength(1000)
  reason!: string;

  @ApiPropertyOptional({
    enum: ["ROUTINE", "SECURITY", "FRAUD", "LEGAL", "INVESTIGATION"],
    description: "Required for SUSPENDED status. Restricted categories require SUPER_ADMIN approval to reinstate.",
  })
  @IsOptional()
  @IsIn(["ROUTINE", "SECURITY", "FRAUD", "LEGAL", "INVESTIGATION"])
  suspension_category?: SuspensionCategory;
}

export class LockUserDto {
  @ApiProperty({ minLength: 5, maxLength: 1000 })
  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  @MaxLength(1000)
  reason!: string;

  @ApiPropertyOptional({
    format: "date-time",
    description: "Optional unlock time; account access is restored only by the shared recovery policy.",
  })
  @IsOptional()
  @IsDateString()
  locked_until?: string;
}
