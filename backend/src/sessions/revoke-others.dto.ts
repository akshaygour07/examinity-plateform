import { ApiProperty } from "@nestjs/swagger";
import { Equals, IsBoolean } from "class-validator";

export class RevokeOtherSessionsDto {
  @ApiProperty({ example: true, description: "Explicit confirmation. The current session is always preserved." })
  @IsBoolean()
  @Equals(true)
  confirmation!: true;
}
