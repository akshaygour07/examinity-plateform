import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, MaxLength, MinLength } from "class-validator";

/**
 * Request body for POST /admin/users/:id/unlock.
 *
 * A human recovery reason is required for administrative unlocks and captured
 * in the ACCOUNT_UNLOCKED audit event. Automatic expiry recovery is system
 * initiated and does not use this request DTO.
 */
export class UnlockUserDto {
  @ApiProperty({
    description: "Mandatory reason for unlocking the account; recorded in the ACCOUNT_UNLOCKED audit event.",
    minLength: 5,
    maxLength: 1000,
    example: "Verified no ongoing security incident. User completed identity verification via support.",
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  @MaxLength(1000)
  reason!: string;
}
