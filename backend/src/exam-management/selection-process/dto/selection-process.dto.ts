import { Type } from "class-transformer";
import { IsBoolean, IsInt, IsIn, IsOptional, IsString, Min } from "class-validator";
export class CreateSelectionProcessDto {
  @IsOptional() @IsIn(["DRAFT", "PUBLISHED"]) publicationStatus?: string;
}
export class SelectionStageDto {
  @IsString() name!: string;
  @IsOptional() @IsString() description?: string;
  @Type(() => Number) @IsInt() @Min(1) sequence!: number;
  @IsOptional() @IsBoolean() isMandatory?: boolean;
  @IsString() stageType!: string;
}
