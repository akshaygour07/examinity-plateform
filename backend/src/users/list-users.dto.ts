import { Transform } from "class-transformer";
import { IsBoolean, IsDateString, IsIn, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";
import { PageQueryDto } from "../common/page-query.dto";

export class ListUsersDto extends PageQueryDto {
  @IsOptional()
  @IsUUID()
  user_id?: string;

  @IsOptional()
  @IsIn(["PENDING", "ACTIVE", "SUSPENDED", "DISABLED"])
  status?: "PENDING" | "ACTIVE" | "SUSPENDED" | "DISABLED";

  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  mobile_number?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  role_code?: string;

  @Transform(({ value }) => (value === "true" ? true : value === "false" ? false : value))
  @IsOptional()
  @IsBoolean()
  email_verified?: boolean;

  @Transform(({ value }) => (value === "true" ? true : value === "false" ? false : value))
  @IsOptional()
  @IsBoolean()
  mobile_verified?: boolean;

  @IsOptional()
  @IsDateString()
  created_from?: string;

  @IsOptional()
  @IsDateString()
  created_to?: string;
}
