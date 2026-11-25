import { ApiProperty } from "@nestjs/swagger";
import { IsIn, IsString, Matches, MaxLength } from "class-validator";

export class PhoneOtpDeliveryDto {
  @ApiProperty({ example: "+919876543210" })
  @IsString()
  @Matches(/^\+[1-9]\d{7,14}$/)
  recipient!: string;

  @ApiProperty({ example: "123456" })
  @IsString()
  @Matches(/^\d{4,10}$/)
  code!: string;

  @ApiProperty({ example: "otp_enroll", enum: ["otp_enroll", "otp_verify"] })
  @IsIn(["otp_enroll", "otp_verify"])
  message_type!: "otp_enroll" | "otp_verify";

  @ApiProperty({ example: "en-IN" })
  @IsString()
  @MaxLength(20)
  locale!: string;
}
