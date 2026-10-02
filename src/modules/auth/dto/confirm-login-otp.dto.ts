import { IsNotEmpty, IsString, IsUUID, Length, Matches } from 'class-validator';

export class ConfirmLoginOtpDto {
  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  code: string;

  @IsUUID()
  @IsNotEmpty()
  loginAttemptId: string;
}
