import { ArrayUnique, IsArray, IsNotEmpty, IsString, IsUUID, MaxLength, MinLength } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class UpdateRolePermissionsDto {
  @ApiProperty({
    type: [String],
    example: ["00000000-0000-4000-8000-000000000003", "00000000-0000-4000-8000-000000000004"],
    description: "Unique IDs from GET /api/v1/permissions. Use an empty array to remove all mappings.",
  })
  @IsArray()
  @ArrayUnique()
  @IsUUID("all", { each: true })
  permission_ids!: string[];

  @ApiProperty({ minLength: 5, maxLength: 500, description: "Mandatory reason for the privileged role-permission mapping change." })
  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  @MaxLength(500)
  reason!: string;
}
