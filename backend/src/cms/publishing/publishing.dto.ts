import { IsDateString, IsOptional, IsString, Length } from "class-validator";
export class PublishDto {
  @IsOptional() @IsString() @Length(0, 5000) comment?: string;
}
export class ScheduleDto {
  @IsDateString() scheduledAt!: string;
  @IsString() timeZone!: string;
}
