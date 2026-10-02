import { ConfirmEmailDto } from '@/modules/auth/dto/confirm-email.dto.js';
import { ConfirmLoginOtpDto } from '@/modules/auth/dto/confirm-login-otp.dto.js';
import { LoginDto } from '@/modules/auth/dto/login.dto.js';
import { RegisterDto } from '@/modules/auth/dto/register.dto.js';
import { ResendLoginOtpDto } from '@/modules/auth/dto/resend-login-otp.dto.js';
import { ResendOtpDto } from '@/modules/auth/dto/resend-otp.dto.js';
import { AuthService } from '@/modules/auth/services/auth.service.js';
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { type Request, type Response } from 'express';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  private setCookies(res: Response, accessToken: string, refreshToken: string) {
    res.cookie('access_token', accessToken, {
      path: '/',
      maxAge: 15 * 60 * 1000,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });
    res.cookie('refresh_token', refreshToken, {
      path: '/auth/refresh',
      maxAge: 30 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });
  }

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('confirm-email')
  confirmEmail(@Body() dto: ConfirmEmailDto) {
    return this.authService.confirmEmail(dto);
  }

  @Post('resend-otp')
  resendOtp(@Body() dto: ResendOtpDto) {
    return this.authService.resendOtp(dto, 'registration');
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
    @Req() req: Request,
  ) {
    const { requireConfirmation, accessToken, refreshToken, loginAttemptId } =
      await this.authService.login(dto, req.ip, req.get('user-agent'));

    if (requireConfirmation) {
      return { requireConfirmation, loginAttemptId };
    }

    this.setCookies(res, accessToken, refreshToken);
    return { ok: true };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!req.cookies.refresh_token) {
      throw new UnauthorizedException('Unauthorized user');
    }

    const { accessToken, refreshToken } = await this.authService.refresh(
      req.cookies.refresh_token,
    );

    this.setCookies(res, accessToken, refreshToken);
    return { ok: true };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('access_token', { path: '/' });
    res.clearCookie('refresh_token', { path: '/auth/refresh' });

    return { ok: true };
  }

  @Post('login/confirm-otp')
  @HttpCode(HttpStatus.OK)
  async confirmOtp(
    @Body() dto: ConfirmLoginOtpDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken } =
      await this.authService.confirmLoginOtp(
        dto,
        req?.ip,
        req?.get('user-agent'),
      );

    this.setCookies(res, accessToken, refreshToken);
    return { ok: true };
  }

  @Post('login/resend')
  @HttpCode(HttpStatus.OK)
  async resendLoginOpt(@Body() dto: ResendLoginOtpDto) {
    return await this.authService.resendLoginOtp(dto.loginAttemptId);
  }
}
