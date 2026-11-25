import { IsNotEmpty, IsString, IsUUID, MaxLength } from "class-validator";

/** Fields required to start an examination data import. */
export class CreateImportJobDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  importType!: string;

  @IsUUID()
  fileMediaId!: string;
}
