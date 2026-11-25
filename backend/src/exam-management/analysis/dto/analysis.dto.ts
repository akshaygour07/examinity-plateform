import { Type } from "class-transformer";
import { IsIn, IsInt, IsObject, IsOptional, IsString, Min } from "class-validator";
export class AnalysisDto {
  @Type(() => Number) @IsInt() @Min(1900) analysisYear!: number;
  @IsString() analysisType!: string;
  @IsString() title!: string;
  @IsOptional() @IsString() description?: string;
  @IsObject() data!: object;
  @IsOptional() @IsIn(["UNVERIFIED", "VERIFIED"]) verificationStatus?: string;
  @IsOptional() @IsIn(["DRAFT", "PUBLISHED"]) publicationStatus?: string;
}
