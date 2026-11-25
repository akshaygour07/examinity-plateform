import { Type } from "class-transformer";
import { ArrayUnique, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUrl, IsUUID, MaxLength, Min } from "class-validator";

const statuses = ["ACTIVE", "INACTIVE"] as const;
export class TaxonomyDto {
  @IsString() @MaxLength(150) name!: string;
  @IsString() @MaxLength(180) slug!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @Type(() => Number) @IsInt() display_order?: number;
  @IsOptional() @IsIn(statuses) status?: string;
  @IsOptional() @IsUUID() category_id?: string | null;
  @IsOptional() @Type(() => Number) @IsInt() expected_version?: number;
}
export class BodyDto {
  @IsString() @MaxLength(200) name!: string;
  @IsOptional() @IsString() @MaxLength(80) short_name?: string;
  @IsString() @MaxLength(180) slug!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsUrl({ require_tld: false }) official_website?: string;
  @IsOptional() @IsUUID() logo_media_id?: string;
  @IsOptional() @IsIn(statuses) status?: string;
  @IsOptional() @Type(() => Number) @IsInt() expected_version?: number;
}
export class ExamDto {
  @IsString() @MaxLength(250) name!: string;
  @IsOptional() @IsString() @MaxLength(100) short_name?: string;
  @IsString() @MaxLength(200) slug!: string;
  @IsOptional() @IsString() description?: string;
  @IsUUID() exam_body_id!: string;
  @IsIn(["CENTRAL", "STATE", "NATIONAL", "INSTITUTIONAL", "OTHER"]) exam_scope!: string;
  @IsOptional() @IsIn(["ONLINE", "OFFLINE", "HYBRID", "OTHER", "NOT_SPECIFIED"]) exam_mode?: string;
  @IsOptional() @IsUrl({ require_tld: false }) official_website?: string;
  @IsOptional() @IsUUID() logo_media_id?: string;
  @IsOptional() @IsBoolean() is_featured?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() display_order?: number;
  @IsOptional() @IsIn(["DRAFT", "ACTIVE", "INACTIVE"]) status?: string;
  @IsArray() @ArrayUnique() @IsUUID("4", { each: true }) category_ids!: string[];
  @IsOptional() @IsArray() @ArrayUnique() @IsUUID("4", { each: true }) group_ids?: string[];
  @IsOptional() @IsArray() @ArrayUnique() @IsUUID("4", { each: true }) state_ids?: string[];
  @IsOptional() @IsUUID() primary_state_id?: string;
  @IsOptional() @Type(() => Number) @IsInt() expected_version?: number;
}
export class AliasDto {
  @IsString() @MaxLength(200) alias!: string;
  @IsOptional() @IsString() @MaxLength(10) language_code?: string;
}
export class CycleDto {
  @Type(() => Number) @IsInt() @Min(1900) cycle_year!: number;
  @IsString() @MaxLength(60) cycle_code!: string;
  @IsString() @MaxLength(100) cycle_label!: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) vacancy_count?: number;
  @IsOptional() @IsString() @MaxLength(200) notification_reference?: string;
  @IsOptional()
  @IsIn([
    "UPCOMING",
    "ACTIVE",
    "APPLICATION_OPEN",
    "APPLICATION_CLOSED",
    "EXAMINATION_COMPLETED",
    "RESULT_DECLARED",
    "CANCELLED",
    "ARCHIVED",
  ])
  cycle_status?: string;
  @IsOptional() @IsIn(["DRAFT", "PUBLISHED", "UNPUBLISHED"]) publication_status?: string;
  @IsOptional() @Type(() => Number) @IsInt() expected_version?: number;
}
export class ExamQueryDto {
  @IsOptional() @IsString() q?: string;
  @IsOptional() @IsUUID() category_id?: string;
  @IsOptional() @IsUUID() group_id?: string;
  @IsOptional() @IsUUID() state_id?: string;
  @IsOptional() @IsUUID() exam_body_id?: string;
  @IsOptional() @IsIn(["CENTRAL", "STATE", "NATIONAL", "INSTITUTIONAL", "OTHER"]) scope?: string;
  @IsOptional() @Type(() => Boolean) @IsBoolean() featured?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Min(1) limit?: number;
}
