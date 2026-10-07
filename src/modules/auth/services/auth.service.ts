import { AuditService } from '@/common/audit/audit.service.js';
import { MailerService } from '@/common/mailer/mailer.service.js';
import { RateLimitService } from '@/common/rate-limit/rate-limit.service.js';
import { UserStatus } from '@/generated/prisma/enums.js';
import {
  jwtConfig,
  refreshSignOptions,
} from '@/modules/auth/config/jwt.config.js';
import { ConfirmEmailDto } from '@/modules/auth/dto/confirm-email.dto.js';
import { ConfirmLoginOtpDto } from '@/modules/auth/dto/confirm-login-otp.dto.js';
import { LoginDto } from '@/modules/auth/dto/login.dto.js';
import { RegisterDto } from '@/modules/auth/dto/register.dto.js';
import { ResendOtpDto } from '@/modules/auth/dto/resend-otp.dto.js';
import { LoginAttemptService } from '@/modules/auth/services/login-attempt.service.js';
import { OtpService } from '@/modules/auth/services/otp.service.js';
import { TJwtServicePayload } from '@/modules/auth/types/jwt-service.js';
import { UserService } from '@/modules/users/user.service.js';
import { PrismaService } from '@/prisma/prisma.service.js';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  private readonly logger: Logger = new Logger(AuthService.name);

  constructor(
    private readonly userService: UserService,
    private readonly otpService: OtpService,
    private readonly prisma: PrismaService,
    private readonly mailerService: MailerService,
    private readonly rateLimitService: RateLimitService,
    private readonly jwtService: JwtService,
    private readonly auditService: AuditService,
    private readonly loginAttemptService: LoginAttemptService,
  ) {}

  async register(dto: RegisterDto): Promise<{
    userId: string;
    email: string;
    status: UserStatus;
    requireConfirmation: boolean;
  }> {
    const email = dto.email.toLowerCase();

    await this.rateLimitService.consume(`ratelimit:register:${email}`);

    const existedEmail = await this.userService.findByEmail(email);
    if (existedEmail) {
      this.logger.warn(`Register conflict: email already exist ${email}`);
      throw new ConflictException('Email already registered.');
    }
    const settings = await this.prisma.systemSetting.findFirst();
    if (!settings) {
      throw new InternalServerErrorException(
        'System settings are not configured',
      );
    }
    const requireConfirmation = settings.requireEmailConfirmationRegistration;
    const status = requireConfirmation ? UserStatus.PENDING : UserStatus.ACTIVE;
    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.userService.create({
      email: dto.email.toLowerCase(),
      password: passwordHash,
      status,
    });

    if (requireConfirmation) {
      const code = await this.otpService.createOtp(user.id, 'registration');
      this.mailerService.sendOtp(user.email, code);
    }

    this.logger.log(
      `Register success: ${email}, userId=${user.id}, status=${user.status}`,
    );

    return {
      userId: user.id,
      email: user.email,
      status: user.status,
      requireConfirmation,
    };
  }

  async confirmEmail(dto: ConfirmEmailDto) {
    const { userId, code } = dto;
    const existUser = await this.userService.findOne(userId);

    if (!existUser) {
      this.logger.warn(`Confirm email: user not found`);
      throw new NotFoundException('User not found');
    }

    if (existUser?.status !== UserStatus.PENDING) {
      this.logger.warn(`Confirm email: user not pending, userId=${userId}`);
      throw new BadRequestException('Status already is Active/Blocked');
    }

    await this.otpService.verifyOtp(userId, code, 'registration');

    const user = await this.userService.updateStatus(
      dto.userId,
      UserStatus.ACTIVE,
    );

    this.logger.log(`Confirm email success: userId=${user.id}`);
    return { userId: user.id, email: user.email, status: user.status };
  }

  async resendOtp(dto: ResendOtpDto, purpose: 'registration' | 'email-change') {
    const existUser = await this.userService.findOne(dto.userId);

    if (!existUser) {
      throw new NotFoundException('User with this email not found');
    }

    if (existUser.status !== UserStatus.PENDING) {
      this.logger.warn(`Resend OTP failed: userId=${existUser?.email}`);
      throw new BadRequestException('This email already active or blocked.');
    }

    try {
      const code = await this.otpService.createOtp(dto.userId, purpose);
      this.mailerService.sendOtp(existUser.email, code);
    } catch (e) {
      if (e instanceof HttpException && e.getStatus() === 429) {
        this.logger.warn(`Resend OTP failed: Verification code already sent.`);
      }
      throw e;
    }

    this.logger.log(`Resend success: userId=${dto.userId}`);
    return { message: 'Verification code send.' };
  }

  async login(dto: LoginDto, ip?: string, userAgent?: string) {
    const email = dto.email.toLowerCase();
    const existUser = await this.userService.findByEmail(email);

    if (await this.rateLimitService.isLoginBlocked(email, ip)) {
      await this.auditService.authLog({
        action: 'LOGIN_LOCKOUT',
        actorId: existUser?.id ?? null,
        metadata: { email, ip },
      });

      throw new HttpException('LOGIN_LOCKOUT', HttpStatus.TOO_MANY_REQUESTS);
    }

    if (!existUser) {
      throw new NotFoundException('User not found')
    }

    if (
      !existUser ||
      !(await bcrypt.compare(dto.password, existUser.password))
    ) {
      await this.auditService.authLog({
        action: 'LOGIN_FAILED',
        actorId: existUser?.id ?? null,
        ...(existUser ? { entityId: existUser.id } : {}),
        metadata: { email, reason: 'invalid_credentials' },
      });

      if (await this.rateLimitService.recordLoginFailure(email, ip)) {
        await this.auditService.authLog({
          action: 'LOGIN_LOCKOUT',
          actorId: existUser?.id ?? null,
          metadata: { email, ip },
        });
        throw new HttpException('LOGIN_LOCKOUT', HttpStatus.TOO_MANY_REQUESTS);
      }

      throw new UnauthorizedException('Invalid credentials');
    }

    if (existUser.status !== UserStatus.ACTIVE) {
      await this.auditService.authLog({
        action: 'LOGIN_FAILED',
        actorId: existUser.id,
        entityId: existUser.id,
        metadata: { email, reason: existUser.status },
      });
      throw new ForbiddenException('Account is disabled');
    }

    const settings = await this.prisma.systemSetting.findFirst();
    if (!settings) {
      throw new InternalServerErrorException(
        'System settings are not configured',
      );
    }

    if (settings?.requireEmailConfirmationLogin) {
      await this.rateLimitService.consume(
        `ratelimit:otp:login:${existUser.id}`,
      );

      const { code, loginAttemptId } =
        await this.loginAttemptService.createLoginAttempt({
          userId: existUser.id,
          ip,
          userAgent,
        });

      await this.mailerService.sendLoginOtp(email, code);
      await this.auditService.authLog({
        action: 'LOGIN_2FA_DISPATCHED',
        actorId: existUser.id,
        entityId: existUser.id,
        metadata: { email },
      });

      await this.rateLimitService.clearLoginFailure(email);

      return {
        requireConfirmation: settings?.requireEmailConfirmationLogin,
        loginAttemptId,
      };
    }

    const accessToken = this.jwtService.sign(
      {
        sub: existUser.id,
        type: 'access',
      },
      {
        expiresIn: jwtConfig.access.expiresIn,
        issuer: jwtConfig.issuer,
        audience: jwtConfig.audience,
      },
    );
    const refreshToken = this.jwtService.sign(
      { sub: existUser.id, type: 'refresh' },
      refreshSignOptions,
    );

    await this.auditService.authLog({
      action: 'LOGIN_SUCCESS',
      actorId: existUser.id,
      entityId: existUser.id,
      metadata: { email },
    });
    await this.rateLimitService.clearLoginFailure(email);
    return {
      requireConfirmation: settings?.requireEmailConfirmationLogin,
      accessToken,
      refreshToken,
    };
  }

  async refresh(token: string) {
    let payload: null | TJwtServicePayload = null;
    try {
      payload = this.jwtService.verify<TJwtServicePayload>(token, {
        secret: jwtConfig.refresh.secret,
        issuer: jwtConfig.issuer,
        audience: jwtConfig.audience,
      });
    } catch (err) {
      const name = err instanceof Error ? err.name : '';
      if (name === 'TokenExpiredError') {
        await this.auditService.authLog({
          action: 'AUTH_DENIED',
          actorId: null,
          metadata: { reason: 'JWT_EXPIRED' },
        });
      }

      if (name === 'JsonWebTokenError') {
        await this.auditService.authLog({
          action: 'AUTH_DENIED',
          actorId: null,
          metadata: { reason: 'INVALID_SIGNATURE' },
        });
      }

      throw new UnauthorizedException('Unauthorized user');
    }

    if (
      !payload ||
      payload.type !== 'refresh' ||
      typeof payload.sub !== 'string'
    ) {
      await this.auditService.authLog({
        action: 'AUTH_DENIED',
        actorId: null,
        metadata: { reason: 'INVALID_SIGNATURE' },
      });
      throw new UnauthorizedException('Unauthorized user');
    }

    const user = await this.userService.findOne(payload.sub);

    if (!user) {
      await this.auditService.authLog({
        action: 'AUTH_DENIED',
        actorId: null,
        metadata: { reason: 'USER_NOT_FOUND' },
      });
      throw new ForbiddenException('Access is forbidden');
    }

    if (user.status === UserStatus.BLOCKED) {
      await this.auditService.authLog({
        action: 'AUTH_DENIED',
        actorId: user.id,
        entityId: user.id,
        metadata: { reason: 'USER_BLOCKED' },
      });
      throw new ForbiddenException('Access is forbidden');
    }

    if (user.status === UserStatus.PENDING) {
      await this.auditService.authLog({
        action: 'AUTH_DENIED',
        actorId: user.id,
        entityId: user.id,
        metadata: { reason: 'USER_PENDING' },
      });
      throw new ForbiddenException('Access is forbidden');
    }

    const accessToken = this.jwtService.sign(
      {
        sub: user.id,
        type: 'access',
      },
      {
        expiresIn: jwtConfig.access.expiresIn,
        issuer: jwtConfig.issuer,
        audience: jwtConfig.audience,
      },
    );
    const refreshToken = this.jwtService.sign(
      { sub: user.id, type: 'refresh' },
      refreshSignOptions,
    );

    return { accessToken, refreshToken };
  }

  async confirmLoginOtp(
    { code, loginAttemptId }: ConfirmLoginOtpDto,
    ip?: string,
    userAgent?: string,
  ) {
    const userId = await this.loginAttemptService.confirmLoginOpt(
      loginAttemptId,
      code,
      ip,
      userAgent,
    );

    const existUser = await this.userService.findOne(userId);

    if (!existUser) {
      throw new NotFoundException('User not found');
    }

    if (existUser.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException('Access is forbidden');
    }

    const accessToken = this.jwtService.sign(
      {
        sub: existUser.id,
        type: 'access',
      },
      {
        expiresIn: jwtConfig.access.expiresIn,
        issuer: jwtConfig.issuer,
        audience: jwtConfig.audience,
      },
    );
    const refreshToken = this.jwtService.sign(
      { sub: existUser.id, type: 'refresh' },
      refreshSignOptions,
    );

    await this.auditService.authLog({
      action: 'LOGIN_SUCCESS',
      actorId: existUser.id,
      entityId: existUser.id,
      metadata: { email: existUser.email },
    });

    await this.rateLimitService.clearLoginFailure(existUser.email);
    return {
      accessToken,
      refreshToken,
    };
  }

  async resendLoginOtp(loginAttemptId: string) {
    const data =
      await this.loginAttemptService.replaceLoginCode(loginAttemptId);

    if (!data) {
      throw new BadRequestException('Login session expired or invalid');
    }

    const existUser = await this.userService.findOne(data.userId);

    if (!existUser) {
      throw new NotFoundException('User not found');
    }

    await this.mailerService.sendLoginOtp(existUser.email, data.code);

    await this.auditService.authLog({
      action: 'LOGIN_2FA_DISPATCHED',
      actorId: existUser.id,
      entityId: existUser.id,
      metadata: { email: existUser.email },
    });

    return { ok: true };
  }
}
