import { ApiProperty } from "@nestjs/swagger";
import { IsString, MaxLength, MinLength } from "class-validator";
import { IsNotEmpty, IsUUID } from "class-validator";

/**
 * Request body for POST /admin/users/:id/reinstate.
 *
 * A mandatory reason is required by the client decision (D2) for every
 * reinstatement request, whether the requesting administrator is a SUPER_ADMIN
 * acting directly or an ADMIN whose request may require further approval.
 */
export class ReinstateUserDto {
  @ApiProperty({
    description:
      "Mandatory reason explaining why the suspended account should be reinstated. " +
      "Recorded in the audit log under the USER_ACCOUNT_REINSTATED or REINSTATEMENT_REQUESTED event.",
    minLength: 10,
    maxLength: 1000,
    example: "Account suspension issue reviewed and resolved. User confirmed identity via support ticket #12345.",
  })
  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  reason!: string;
}

export class ApproveReinstatementDto {
  @ApiProperty({ format: "uuid", description: "Audit ID returned by the ADMIN-initiated reinstatement request." })
  @IsUUID()
  request_audit_id!: string;

  @ApiProperty({ minLength: 10, maxLength: 1000, description: "SUPER_ADMIN approval and restriction-clearance reason." })
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  @MaxLength(1000)
  approval_reason!: string;
}

export class RejectReinstatementDto {
  @ApiProperty({ format: "uuid", description: "Audit ID returned by the ADMIN-initiated reinstatement request." })
  @IsUUID()
  request_audit_id!: string;

  @ApiProperty({ minLength: 10, maxLength: 1000, description: "Mandatory reason for rejecting the reinstatement request." })
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  @MaxLength(1000)
  rejection_reason!: string;
}
