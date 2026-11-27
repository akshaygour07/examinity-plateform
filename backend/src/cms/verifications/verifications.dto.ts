import { IsArray, IsOptional, IsString, Length } from "class-validator";
export class VerifyDto {
  @IsOptional() @IsString() @Length(0, 5000) verificationNotes?: string;
  @IsArray() sourceIds!: string[];
}
export class VerificationChangesDto {
  @IsString() @Length(1, 5000) comments!: string;
}
