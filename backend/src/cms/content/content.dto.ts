import { Type } from "class-transformer";
import { IsInt, IsObject, IsOptional, IsString, IsUUID, Length, Matches, Max, Min } from "class-validator";

export class CreateContentDto {
  @IsUUID() contentTypeId!: string;
  @IsString() @Matches(/^[a-z0-9][a-z0-9-]{0,99}$/) contentKey!: string;
  @IsOptional() @IsString() @Length(2, 10) defaultLocale?: string;
  @IsString() @Length(1, 300) title!: string;
  @IsString() @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) @Length(1, 350) slug!: string;
  @IsOptional() @IsString() @Length(0, 1000) summary?: string;
  @IsObject() body!: Record<string, unknown>;
}
export class ListContentDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsUUID() contentTypeId?: string;
}
export class UpdateContentDto {
  @IsUUID() revisionId!: string;
  @Type(() => Number) @IsInt() @Min(1) expectedVersion!: number;
  @IsOptional() @IsString() @Length(1, 300) title?: string;
  @IsOptional() @IsString() @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) @Length(1, 350) slug?: string;
  @IsOptional() @IsString() @Length(0, 1000) summary?: string;
  @IsOptional() @IsObject() body?: Record<string, unknown>;
}
export class ArchiveContentDto {
  @IsString() @Length(1, 1000) reason!: string;
}
