import { Type } from "class-transformer";
import { IsArray, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, Min, ValidateNested } from "class-validator";
export class TopicTranslationDto {
  @IsString() @IsIn(["en", "hi"]) languageCode!: string;
  @IsString() @IsNotEmpty() @MaxLength(300) name!: string;
  @IsOptional() @IsString() description?: string;
}
export class CreateSyllabusDto {
  @IsString() @IsNotEmpty() @MaxLength(250) title!: string;
  @IsOptional() @IsString() description?: string;
}
export class CreateSyllabusVersionDto {
  @IsString() @IsNotEmpty() @MaxLength(100) versionLabel!: string;
  @IsOptional() @IsString() @IsIn(["en", "hi"]) languageDefault?: string;
  @IsOptional() @IsUUID() sourceReferenceId?: string;
  @IsOptional() @IsUUID() officialDocumentId?: string;
}
export class CreateSyllabusStageDto {
  @IsString() @IsNotEmpty() @MaxLength(200) name!: string;
  @Type(() => Number) @IsInt() @Min(1) sequence!: number;
  @IsOptional() @IsUUID() examStageId?: string;
}
export class CreateSyllabusPaperDto {
  @IsString() @IsNotEmpty() @MaxLength(200) name!: string;
  @Type(() => Number) @IsInt() @Min(1) sequence!: number;
  @IsOptional() @IsUUID() examPaperId?: string;
}
export class CreateSyllabusSubjectDto {
  @IsString() @IsNotEmpty() @MaxLength(250) name!: string;
  @IsOptional() @IsString() description?: string;
  @Type(() => Number) @IsInt() @Min(1) sequence!: number;
}
export class CreateSyllabusTopicDto {
  @IsString() @IsNotEmpty() @MaxLength(300) name!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() @MaxLength(100) topicCode?: string;
  @IsOptional() @IsUUID() parentTopicId?: string | null;
  @Type(() => Number) @IsInt() @Min(1) displayOrder!: number;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => TopicTranslationDto) translations?: TopicTranslationDto[];
}
export class UpdateSyllabusTopicDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(300) name?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() @MaxLength(100) topicCode?: string;
  @IsOptional() @IsUUID() parentTopicId?: string | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) displayOrder?: number;
  @IsOptional() @IsString() @IsIn(["ACTIVE", "INACTIVE"]) status?: string;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => TopicTranslationDto) translations?: TopicTranslationDto[];
}
