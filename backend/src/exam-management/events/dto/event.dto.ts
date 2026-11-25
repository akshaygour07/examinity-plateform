import { IsDateString, IsIn, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";
export class EventDto {
  @IsString() @MaxLength(50) eventType!: string;
  @IsString() @MaxLength(200) title!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsDateString() startAt?: string;
  @IsOptional() @IsDateString() endAt?: string;
  @IsOptional() @IsString() displayTimezone?: string;
  @IsOptional() @IsUUID() sourceReferenceId?: string;
  @IsOptional() @IsIn(["DRAFT", "ACTIVE", "CANCELLED"]) eventStatus?: string;
}
export class EventRevisionDto {
  @IsString() revisionReason!: string;
  @IsOptional() @IsDateString() startAt?: string;
  @IsOptional() @IsDateString() endAt?: string;
  @IsOptional() @IsUUID() sourceReferenceId?: string;
}
export class CancelEventDto {
  @IsString() reason!: string;
  @IsOptional() @IsUUID() sourceReferenceId?: string;
}
