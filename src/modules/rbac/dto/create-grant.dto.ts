import { IsArray, IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class CreateGrantDto {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  roleId: string;

  @IsString()
  @IsNotEmpty()
  @IsUUID()
  permissionId: string;

  @IsArray()
  @IsString({ each: true })
  actions: string[];
}
