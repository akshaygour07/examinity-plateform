import { IsOptional, IsString, IsUUID, Length } from "class-validator";
export class SubmitContentDto {
  @IsOptional() @IsString() @Length(0, 2000) comment?: string;
}
export class AssignTaskDto {
  @IsUUID() userId!: string;
}
