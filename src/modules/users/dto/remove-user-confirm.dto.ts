import { IsString, Length } from 'class-validator';

export class RemoveUserConfirm {
  @IsString()
  @Length(6, 6)
  code: string;
}
