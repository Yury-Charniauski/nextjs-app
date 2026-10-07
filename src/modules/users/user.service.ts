import { AuditService } from '@/common/audit/audit.service.js';
import { MailerService } from '@/common/mailer/mailer.service.js';
import { RateLimitService } from '@/common/rate-limit/rate-limit.service.js';
import { Prisma } from '@/generated/prisma/client.js';
import { UserStatus } from '@/generated/prisma/enums.js';
import { OtpService } from '@/modules/auth/services/otp.service.js';
import { TAuth } from '@/modules/auth/types/auth.types.js';
import { RemoveUserConfirm } from '@/modules/users/dto/remove-user-confirm.dto.js';
import { UpdateEmailDto } from '@/modules/users/dto/update-email.dto.js';
import { UpdatePasswordDto } from '@/modules/users/dto/update-password.dto.js';
import { UpdateProfileDto } from '@/modules/users/dto/update-profile.dto.js';
import { PrismaService } from '@/prisma/prisma.service.js';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly otpService: OtpService,
    private readonly mailerService: MailerService,
    private readonly rateLimitService: RateLimitService,
  ) {}

  private async anonymizeUser(
    id: string,
    tx: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    const user = await tx.user.findFirst({
      where: { id, deletedAt: null },
    });

    if (!user) throw new NotFoundException('User not found');

    return tx.user.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        name: null,
        email: `deleted+${id}@deleted.local`,
        password: await bcrypt.hash(randomBytes(32).toString('hex'), 10),
      },
    });
  }

  async create(data: { email: string; password: string; status: UserStatus }) {
    return this.prisma.$transaction(async (tx) => {
      const defaultRole = await tx.role.findUnique({ where: { name: 'user' } });

      if (!defaultRole) {
        throw new InternalServerErrorException(
          'Default role is not configured',
        );
      }

      const created = await tx.user.create({
        data,
        select: {
          id: true,
          email: true,
          status: true,
        },
      });

      await tx.userRole.create({
        data: { userId: created.id, roleId: defaultRole.id },
      });

      return created;
    });
  }

  async findAll() {
    return this.prisma.user.findMany({
      where: {
        deletedAt: null,
      },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
      },
    });
  }

  async findOne(id: string) {
    return this.prisma.user.findUnique({
      where: { id, deletedAt: null },
      select: { id: true, email: true, status: true, name: true },
    });
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email, deletedAt: null },
    });
  }

  async updateStatus(id: string, status: UserStatus) {
    return this.prisma.user.update({
      where: { id },
      data: { status },
      select: { id: true, email: true, status: true },
    });
  }

  async updateName(dto: UpdateProfileDto, user: TAuth) {
    return await this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: user.id },
        data: {
          name: dto.name,
        },
        select: {
          id: true,
          name: true,
          email: true,
          status: true,
        },
      });

      await this.auditService.log(
        {
          action: 'update',
          entity: 'user',
          entityId: updated.id,
        },
        tx,
      );

      return updated;
    });
  }

  async updatePassword(dto: UpdatePasswordDto, user: TAuth) {
    return await this.prisma.$transaction(async (tx) => {
      const existUser = await tx.user.findUnique({
        where: { id: user.id },
      });

      if (!existUser) throw new NotFoundException('User not found');

      const isCurrentPasswordCorrect = await bcrypt.compare(
        dto.currentPassword,
        existUser.password,
      );

      if (!isCurrentPasswordCorrect)
        throw new BadRequestException('Current password is incorrect');

      const newPassword = await bcrypt.hash(dto.newPassword, 10);

      await tx.user.update({
        where: { id: user.id },
        data: {
          password: newPassword,
        },
      });

      await this.auditService.log(
        {
          action: 'update',
          entity: 'user',
          entityId: existUser.id,
        },
        tx,
      );

      return { message: 'Password updated' };
    });
  }

  async updateEmail(dto: UpdateEmailDto, user: TAuth) {
    const email = dto.email.toLowerCase();
    const activeUser = await this.prisma.user.findUnique({
      where: { id: user.id },
    });

    if (!activeUser) throw new NotFoundException('User not found');

    if (activeUser.email === email)
      throw new BadRequestException('This email already using by you');

    const existUser = await this.findByEmail(email);
    if (existUser)
      throw new ConflictException('This email taken by another user');

    if (!(await bcrypt.compare(dto.password, activeUser.password)))
      throw new BadRequestException('Password is incorrect');

    const code = await this.otpService.createOtp(user.id, 'email-change', {
      newEmail: email,
    });

    await this.mailerService.sendOtp(email, code);

    return { message: 'OTP code was send to you new email address' };
  }

  async confirmUpdateEmail(code: string, userId: string) {
    const existUser = await this.findOne(userId);
    if (!existUser) {
      throw new NotFoundException('User not found');
    }

    const { newEmail } = await this.otpService.verifyOtp(
      userId,
      code,
      'email-change',
    );

    if (!newEmail) {
      throw new BadRequestException(
        'Verification code expires or does not exist',
      );
    }

    const isEmailExist = await this.findByEmail(newEmail);

    if (isEmailExist) {
      throw new ConflictException('This email taken by another user');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { email: newEmail },
      });

      await this.auditService.log(
        {
          action: 'update',
          entity: 'user',
          entityId: userId,
        },
        tx,
      );

      return { message: 'Email successfully updated' };
    });
  }

  async selfRemoveUser({ id: userId, email }: TAuth, reason?: string) {
    const code = await this.otpService.createOtp(userId, 'account-deletion', {
      reason,
    });
    await this.mailerService.sendOtp(email, code);

    return { message: 'OTP code is send' };
  }

  async selfRemoveUserConfirm(userId: string, code: string) {
    const { reason } = await this.otpService.verifyOtp(
      userId,
      code,
      'account-deletion',
    );

    await this.prisma.$transaction(async (tx) => {
      await this.anonymizeUser(userId, tx);

      await this.auditService.log(
        {
          action: 'delete',
          entity: 'user',
          entityId: userId,
          metadata: { type: 'self', reason },
        },
        tx,
      );
    });

    return { message: 'User removed' };
  }

  async removeUser(removeUserId: string, actorId: string, reason?: string) {
    if (removeUserId === actorId) {
      throw new BadRequestException('Bad request');
    }

    await this.prisma.$transaction(async (tx) => {
      await this.anonymizeUser(removeUserId, tx);

      await this.auditService.log(
        {
          action: 'delete',
          entity: 'user',
          entityId: removeUserId,
          metadata: { type: 'admin', reason },
        },
        tx,
      );
    });

    return { message: 'User removed' };
  }
}
