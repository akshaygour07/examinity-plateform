import { IsString, Length } from "class-validator";
export class ApprovalDto {
  @IsString() @Length(1, 5000) comments!: string;
}
