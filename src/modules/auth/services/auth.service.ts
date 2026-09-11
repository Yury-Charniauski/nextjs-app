import { MailerService } from '@/common/mailer/mailer.service.js';
import { UserStatus } from '@/generated/prisma/enums.js';
import { ConfirmEmailDto } from '@/modules/auth/dto/confirm-email.dto.js';
import { RegisterDto } from '@/modules/auth/dto/register.dto.js';
import { ResentOtpDto } from '@/modules/auth/dto/resent-otp.dto.js';
import { OtpService } from '@/modules/auth/services/otp.service.js';
import { UserService } from '@/modules/users/user.service.js';
import { PrismaService } from '@/prisma/prisma.service.js';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly otpService: OtpService,
    private readonly prisma: PrismaService,
    private readonly mailerService: MailerService,
  ) {}

  async register(dto: RegisterDto): Promise<{
    userId: string;
    email: string;
    status: UserStatus;
    requireConfirmation: boolean;
  }> {
    const existedEmail = await this.userService.findByEmail(dto.email);
    if (existedEmail) {
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
      email: dto.email,
      password: passwordHash,
      status,
    });

    if (requireConfirmation) {
      const code = await this.otpService.createOtp(user.id);
      this.mailerService.sendRegistrationOtp(user.email, code);
    }

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
      throw new NotFoundException('User is not exist');
    }

    if (existUser?.status !== UserStatus.PENDING) {
      throw new BadRequestException('Status already is Active/Blocked');
    }

    await this.otpService.verifyOtp(userId, code);
    const user = await this.userService.updateStatus(
      dto.userId,
      UserStatus.ACTIVE,
    );
    return { userId: user.id, email: user.email, status: user.status };
  }

  async resendOtp(dto: ResentOtpDto) {
    const existUser = await this.userService.findOne(dto.userId);

    if (existUser?.status !== UserStatus.PENDING) {
      throw new BadRequestException('This email already active or blocked.');
    }

    const code = await this.otpService.createOtp(dto.userId);
    this.mailerService.sendRegistrationOtp(existUser.email, code)

    return { massage: 'Verification code send.' };
  }
}
