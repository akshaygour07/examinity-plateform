import { IsOptional, IsString, IsUUID, Length } from "class-validator";
export class CreateRevisionDto {
  @IsUUID() sourceRevisionId!: string;
  @IsOptional() @IsString() @Length(2, 10) locale?: string;
}
