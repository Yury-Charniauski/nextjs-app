import { IsNotEmpty, Length } from "class-validator"

export class ConfirmEmailDto {
	@IsNotEmpty({ message: 'UserId is required.' })
	userId: string

	@Length(6, 6)
	code: string
}
