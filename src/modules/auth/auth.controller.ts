import { RegisterDto } from "@/modules/auth/dto/register.dto.js";
import { AuthService } from "@/modules/auth/services/auth.service.js";
import { Body, Controller, Post } from "@nestjs/common";


@Controller('auth')
export class AuthController {
	constructor(private readonly authService: AuthService) { }
	
	@Post('register')
	register(@Body() dto: RegisterDto) {
		return this.authService.register(dto)
	}
}
