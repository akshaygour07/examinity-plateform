import { Allow, IsIn, IsInt, IsNotEmpty, IsString, MaxLength, Min } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class PutConfigurationDto {
  @ApiProperty({
    description: "JSON value allowed by the selected configuration key's schema.",
    oneOf: [{ type: "string" }, { type: "number" }, { type: "boolean" }, { type: "object" }, { type: "array" }],
    example: "en-IN",
  })
  @Allow()
  value!: unknown;
  @ApiProperty({ minimum: 1, example: 1, description: "Required current version returned by GET /api/v1/configurations/{key}." })
  @IsInt()
  @Min(1)
  expected_version!: number;

  @ApiProperty({ maxLength: 500, description: "Mandatory reason for an administrative setting change." })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}

export class UpdateConfigurationStatusDto {
  @ApiProperty({ enum: ["ACTIVE", "INACTIVE"] })
  @IsIn(["ACTIVE", "INACTIVE"])
  status!: "ACTIVE" | "INACTIVE";

  @ApiProperty({ minimum: 1, example: 1 })
  @IsInt()
  @Min(1)
  expected_version!: number;

  @ApiProperty({ maxLength: 500 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}
