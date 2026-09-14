import { IsNotEmpty, IsString } from 'class-validator';

export class ResendOtpDto {
  @IsNotEmpty({ message: 'Id is not should be empty' })
  @IsString()
  userId: string;
}
