import 'dotenv/config';
import { AuditService } from '@/common/audit/audit.service.js';
import { MailerService } from '@/common/mailer/mailer.service.js';
import { RateLimitService } from '@/common/rate-limit/rate-limit.service.js';
import { TAuth } from '@/modules/auth/types/auth.types.js';
import { OtpService } from '@/modules/auth/services/otp.service.js';
import { PrismaService } from '@/prisma/prisma.service.js';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { vi } from 'vitest';
import { UserService } from './user.service.js';

describe('UserService', () => {
  let userService: UserService;

  const tx = {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  };

  const prisma = {
    $transaction: vi.fn(),
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
  };

  const auditService = { log: vi.fn() };
  const otpService = { createOtp: vi.fn(), verifyOtp: vi.fn() };
  const mailerService = { sendOtp: vi.fn() };
  const rateLimitService = { consume: vi.fn() };

  const authUser: TAuth = {
    id: 'user-1',
    email: 'user@test.com',
    roles: [],
  };

  let passwordHash: string;

  beforeAll(async () => {
    passwordHash = await bcrypt.hash('Password1', 4);
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    prisma.$transaction.mockImplementation(
      async (cb: (txArg: typeof tx) => unknown) => cb(tx),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: auditService },
        { provide: OtpService, useValue: otpService },
        { provide: MailerService, useValue: mailerService },
        { provide: RateLimitService, useValue: rateLimitService },
      ],
    }).compile();

    userService = module.get(UserService);
  });

  describe('selfRemoveUser', () => {
    it('creates a deletion OTP with the reason and emails the user', async () => {
      otpService.createOtp.mockResolvedValue('123456');

      const result = await userService.selfRemoveUser(authUser, 'no longer');

      expect(otpService.createOtp).toHaveBeenCalledWith(
        'user-1',
        'account-deletion',
        { reason: 'no longer' },
      );
      expect(mailerService.sendOtp).toHaveBeenCalledWith(
        'user@test.com',
        '123456',
      );
      expect(result).toEqual({ message: 'OTP code is send' });
    });
  });

  describe('selfRemoveUserConfirm', () => {
    it('anonymizes the user and writes a self delete audit entry', async () => {
      otpService.verifyOtp.mockResolvedValue({ reason: 'no longer' });
      tx.user.findFirst.mockResolvedValue({ id: 'user-1' });
      tx.user.update.mockResolvedValue({ id: 'user-1' });

      const result = await userService.selfRemoveUserConfirm(
        'user-1',
        '123456',
      );

      expect(otpService.verifyOtp).toHaveBeenCalledWith(
        'user-1',
        '123456',
        'account-deletion',
      );

      const updateArg = tx.user.update.mock.calls[0][0];
      expect(updateArg.where).toEqual({ id: 'user-1' });
      expect(updateArg.data.name).toBeNull();
      expect(updateArg.data.email).toBe('deleted+user-1@deleted.local');
      expect(updateArg.data.deletedAt).toBeInstanceOf(Date);
      expect(updateArg.data.password).not.toBe(passwordHash);

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'delete',
          entity: 'user',
          entityId: 'user-1',
          metadata: { type: 'self', reason: 'no longer' },
        }),
        tx,
      );
      expect(result).toEqual({ message: 'User removed' });
    });

    it('throws NotFoundException when the user is already deleted', async () => {
      otpService.verifyOtp.mockResolvedValue({ reason: undefined });
      tx.user.findFirst.mockResolvedValue(null);

      await expect(
        userService.selfRemoveUserConfirm('user-1', '123456'),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(tx.user.update).not.toHaveBeenCalled();
      expect(auditService.log).not.toHaveBeenCalled();
    });
  });

  describe('updatePassword', () => {
    it('throws BadRequestException when the current password is wrong', async () => {
      tx.user.findUnique.mockResolvedValue({
        id: 'user-1',
        password: passwordHash,
      });

      await expect(
        userService.updatePassword(
          { currentPassword: 'WrongPass1', newPassword: 'NewPassword1' },
          authUser,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(tx.user.update).not.toHaveBeenCalled();
    });

    it('hashes and stores the new password when the current one matches', async () => {
      tx.user.findUnique.mockResolvedValue({
        id: 'user-1',
        password: passwordHash,
      });
      tx.user.update.mockResolvedValue({ id: 'user-1' });

      const result = await userService.updatePassword(
        { currentPassword: 'Password1', newPassword: 'NewPassword1' },
        authUser,
      );

      const updateArg = tx.user.update.mock.calls[0][0];
      expect(updateArg.data.password).not.toBe('NewPassword1');
      await expect(
        bcrypt.compare('NewPassword1', updateArg.data.password),
      ).resolves.toBe(true);
      expect(result).toEqual({ message: 'Password updated' });
    });
  });

  describe('updateEmail', () => {
    it('throws BadRequestException when the new email equals the current one', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'user@test.com',
        password: passwordHash,
      });

      await expect(
        userService.updateEmail(
          { email: 'User@test.com', password: 'Password1' },
          authUser,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(otpService.createOtp).not.toHaveBeenCalled();
    });

    it('throws ConflictException when the new email is taken', async () => {
      prisma.user.findUnique
        .mockResolvedValueOnce({
          id: 'user-1',
          email: 'user@test.com',
          password: passwordHash,
        })
        .mockResolvedValueOnce({ id: 'user-2', email: 'new@test.com' });

      await expect(
        userService.updateEmail(
          { email: 'new@test.com', password: 'Password1' },
          authUser,
        ),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(otpService.createOtp).not.toHaveBeenCalled();
    });

    it('sends an email-change OTP to the new address on success', async () => {
      prisma.user.findUnique
        .mockResolvedValueOnce({
          id: 'user-1',
          email: 'user@test.com',
          password: passwordHash,
        })
        .mockResolvedValueOnce(null);
      otpService.createOtp.mockResolvedValue('123456');

      const result = await userService.updateEmail(
        { email: 'New@test.com', password: 'Password1' },
        authUser,
      );

      expect(otpService.createOtp).toHaveBeenCalledWith(
        'user-1',
        'email-change',
        { newEmail: 'new@test.com' },
      );
      expect(mailerService.sendOtp).toHaveBeenCalledWith('new@test.com', '123456');
      expect(result).toEqual({
        message: 'OTP code was send to you new email address',
      });
    });
  });
});
