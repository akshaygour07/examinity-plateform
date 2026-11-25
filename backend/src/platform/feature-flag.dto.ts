import { IsBoolean, IsIn, IsInt, IsNotEmpty, IsString, MaxLength, Min } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class PutFeatureFlagDto {
  @ApiProperty({ example: false, description: "Whether the registered feature is enabled." })
  @IsBoolean()
  enabled!: boolean;

  @ApiProperty({ example: 1, minimum: 1, description: "Required current flag version to prevent overwriting a newer update (D5)." })
  @IsInt()
  @Min(1)
  expected_version!: number;

  @ApiProperty({ maxLength: 500, description: "Mandatory reason for changing this feature flag; recorded in the audit log." })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}

export class UpdateFeatureFlagStatusDto {
  @ApiProperty({ enum: ["ACTIVE", "INACTIVE"] })
  @IsIn(["ACTIVE", "INACTIVE"])
  status!: "ACTIVE" | "INACTIVE";

  @ApiProperty({ example: 1, minimum: 1 })
  @IsInt()
  @Min(1)
  expected_version!: number;

  @ApiProperty({ maxLength: 500 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}
