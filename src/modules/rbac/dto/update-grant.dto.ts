import { IsArray, IsString } from 'class-validator';

export class UpdateGrantDto {
  @IsArray()
  @IsString({ each: true })
  actions: string[];
}
