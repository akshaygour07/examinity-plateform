import { IsArray, IsNotEmpty, IsOptional, IsString, Length, ValidateIf } from "class-validator";
export class ApproveReviewDto {
  @ValidateIf((x) => !x.comments) @IsArray() @IsOptional() fieldComments?: unknown[];
  @IsOptional() @IsString() @Length(0, 5000) comments?: string;
}
export class RequestChangesDto {
  @IsString() @IsNotEmpty() @Length(1, 5000) comments!: string;
  @IsOptional() @IsArray() fieldComments?: unknown[];
}
