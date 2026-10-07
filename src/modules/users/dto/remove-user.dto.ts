import { IsOptional, IsString } from 'class-validator';

export class RemoveUserDto {
  @IsString()
  @IsOptional()
  reason?: string;
}
