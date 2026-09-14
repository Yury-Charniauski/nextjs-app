import { MailerService } from '@/common/mailer/mailer.service.js';
import { RateLimitService } from '@/common/rate-limit/rate-limit.service.js';
import { UserStatus } from '@/generated/prisma/enums.js';
import { ConfirmEmailDto } from '@/modules/auth/dto/confirm-email.dto.js';
import { RegisterDto } from '@/modules/auth/dto/register.dto.js';
import { ResendOtpDto } from '@/modules/auth/dto/resend-otp.dto.js';
import { OtpService } from '@/modules/auth/services/otp.service.js';
import { UserService } from '@/modules/users/user.service.js';
import { PrismaService } from '@/prisma/prisma.service.js';
import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
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
  ) {}

  async register(dto: RegisterDto): Promise<{
    userId: string;
    email: string;
    status: UserStatus;
    requireConfirmation: boolean;
  }> {
    const email = dto.email.toLowerCase();

    try {
      await this.rateLimitService.consume(`ratelimit:register:${email}`, 60);
    } catch (e) {
      if (e instanceof HttpException && e.getStatus() === 429) {
        this.logger.warn(`Register rate limited: ${email}`);
      }
      throw e;
    }

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
      const code = await this.otpService.createOtp(user.id);
      this.mailerService.sendRegistrationOtp(user.email, code);
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

    await this.otpService.verifyOtp(userId, code);
    const user = await this.userService.updateStatus(
      dto.userId,
      UserStatus.ACTIVE,
    );

    this.logger.log(`Confirm email success: userId=${user.id}`);
    return { userId: user.id, email: user.email, status: user.status };
  }

  async resendOtp(dto: ResendOtpDto) {
    const existUser = await this.userService.findOne(dto.userId);

    if (!existUser) {
      throw new NotFoundException('User with this email not found');
    }

    if (existUser.status !== UserStatus.PENDING) {
      this.logger.warn(`Resend OTP failed: userId=${existUser?.email}`);
      throw new BadRequestException('This email already active or blocked.');
    }

    try {
      const code = await this.otpService.createOtp(dto.userId);
      this.mailerService.sendRegistrationOtp(existUser.email, code);
    } catch (e) {
      if (e instanceof HttpException && e.getStatus() === 429) {
        this.logger.warn(`Resend OTP failed: Verification code already sent.`);
      }
      throw e;
    }

    this.logger.log(`Resend success: userId=${dto.userId}`);
    return { message: 'Verification code send.' };
  }
}
