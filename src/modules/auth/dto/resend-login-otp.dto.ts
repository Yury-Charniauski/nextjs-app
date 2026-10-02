import { IsUUID } from 'class-validator';

export class ResendLoginOtpDto {
  @IsUUID()
  loginAttemptId: string;
}
