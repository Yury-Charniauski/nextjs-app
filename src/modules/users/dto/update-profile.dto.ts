import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class UpdateProfileDto {
	@IsString()
	@IsOptional()
	@MinLength(1)
	@MaxLength(100)
	name?: string;
}
