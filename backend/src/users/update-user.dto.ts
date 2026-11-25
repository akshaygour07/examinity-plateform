import { IsOptional, IsString, IsTimeZone, Matches, MaxLength } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class UpdateUserDto {
  @ApiPropertyOptional({ example: "Hari", maxLength: 100, description: "User's given name." })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  first_name?: string;
  @ApiPropertyOptional({ example: "Sharma", maxLength: 100, description: "User's family name." })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  last_name?: string;
  @ApiPropertyOptional({ example: "Hari Sharma", maxLength: 150 })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  display_name?: string;
  @ApiPropertyOptional({ example: "en-IN", maxLength: 20, pattern: "^[a-zA-Z]{2,3}(?:-[a-zA-Z0-9]{2,8})*$" })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Matches(/^[a-zA-Z]{2,3}(?:-[a-zA-Z0-9]{2,8})*$/)
  locale?: string;
  @ApiPropertyOptional({ example: "Asia/Kolkata", maxLength: 50, description: "IANA time zone name." })
  @IsOptional()
  @IsString()
  @IsTimeZone()
  @MaxLength(50)
  timezone?: string;
}
