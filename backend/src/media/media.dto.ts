import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class PresignMediaDto {
  @ApiProperty({ example: "sample.pdf", maxLength: 255 })
  @IsString()
  @MaxLength(255)
  original_filename!: string;
  @ApiProperty({ enum: ["image/jpeg", "image/png", "image/webp", "application/pdf"], example: "application/pdf" })
  @IsIn(["image/jpeg", "image/png", "image/webp", "application/pdf"])
  mime_type!: string;
  @ApiProperty({ example: 12345, minimum: 1, maximum: 104857600, description: "File size in bytes; maximum 100 MiB." })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(104857600)
  file_size_bytes!: number;
  @ApiPropertyOptional({ enum: ["PRIVATE", "PUBLIC"], default: "PRIVATE", example: "PRIVATE" })
  @IsOptional()
  @IsIn(["PRIVATE", "PUBLIC"])
  visibility: "PRIVATE" | "PUBLIC" = "PRIVATE";
}
