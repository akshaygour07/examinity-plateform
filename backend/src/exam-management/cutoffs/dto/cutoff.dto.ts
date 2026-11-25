import { IsNumber, IsString } from "class-validator";
export class CutoffDto {
  @IsNumber() cutoffYear!: number;
  @IsString() stageType!: string;
  @IsString() categoryCode!: string;
  @IsNumber() cutoffMarks!: number;
  @IsString() cutoffType!: string;
}
