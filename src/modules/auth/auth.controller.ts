import { ConfirmEmailDto } from "@/modules/auth/dto/confirm-email.dto.js";
import { RegisterDto } from "@/modules/auth/dto/register.dto.js";
import { ResentOtpDto } from "@/modules/auth/dto/resent-otp.dto.js";
import { AuthService } from "@/modules/auth/services/auth.service.js";
import { Body, Controller, Post } from "@nestjs/common";


@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('confirm-email')
  confirmEmail(@Body() dto: ConfirmEmailDto) {
    return this.authService.confirmEmail(dto);
  }

  @Post('resend-otp')
  resendOtp(@Body() dto: ResentOtpDto) {
    return this.authService.resendOtp(dto);
  }
}
