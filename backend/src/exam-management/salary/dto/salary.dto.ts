import { IsOptional, IsString } from "class-validator";
export class SalaryDto {
  @IsString() postName!: string;
  @IsOptional() @IsString() payLevel?: string;
  @IsOptional() basicPayMin?: number;
  @IsOptional() basicPayMax?: number;
  @IsOptional() @IsString() payScale?: string;
  @IsOptional() allowances?: object;
  @IsOptional() @IsString() benefits?: string;
  @IsOptional() @IsString() effectiveFrom?: string;
  @IsOptional() @IsString() effectiveTo?: string;
}
