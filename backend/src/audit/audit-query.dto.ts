import { IsDateString, IsIn, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";
import { PageQueryDto } from "../common/page-query.dto";

export class AuditQueryDto extends PageQueryDto {
  @IsOptional() @IsString() @MaxLength(100) action?: string;
  @IsOptional() @IsString() @MaxLength(100) resource_type?: string;
  @IsOptional() @IsUUID() resource_id?: string;
  @IsOptional() @IsUUID() actor_user_id?: string;
  @IsOptional() @IsUUID() target_user_id?: string;
  @IsOptional() @IsIn(["SUCCESS", "FAILURE"]) result?: string;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
}
