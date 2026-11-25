import { IsOptional, IsString, IsUUID } from "class-validator";

export class PutOverviewDraftDto {
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() qualificationSummary?: string;
  @IsOptional() @IsString() ageSummary?: string;
  @IsOptional() @IsString() vacancySummary?: string;
  @IsOptional() @IsString() modeSummary?: string;
  @IsOptional() @IsString() notificationSummary?: string;
  @IsOptional() @IsUUID() sourceReferenceId?: string;
}
