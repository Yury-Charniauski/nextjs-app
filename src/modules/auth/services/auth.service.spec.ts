import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { UserService } from '@/modules/users/user.service.js';
import { OtpService } from '@/modules/auth/services/otp.service.js';
import { PrismaService } from '@/prisma/prisma.service.js';
import { UserStatus } from '@/generated/prisma/enums.js';
import { RegisterDto } from '@/modules/auth/dto/register.dto.js';
import { ConfirmEmailDto } from '@/modules/auth/dto/confirm-email.dto.js';

describe('AuthService', () => {
  let authService: AuthService;

  const userService = {
    findByEmail: vi.fn(),
    create: vi.fn(),
    findOne: vi.fn(),
    updateStatus: vi.fn(),
  };

  const otpService = {
    createOtp: vi.fn(),
    verifyOtp: vi.fn(),
  };

  const prisma = {
    systemSetting: {
      findFirst: vi.fn(),
    },
  };

  const registerDto: RegisterDto = {
    email: 'user@test.com',
    password: 'Password1',
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UserService, useValue: userService },
        { provide: OtpService, useValue: otpService },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    authService = module.get(AuthService);
  });

  describe('register', () => {
    it('creates PENDING user and OTP when confirmation is required', async () => {
      userService.findByEmail.mockResolvedValue(null);
      prisma.systemSetting.findFirst.mockResolvedValue({
        requireEmailConfirmationRegistration: true,
      });
      userService.create.mockResolvedValue({
        id: 'user-1',
        email: registerDto.email,
        status: UserStatus.PENDING,
      });
      otpService.createOtp.mockResolvedValue('123456');

      const result = await authService.register(registerDto);

      expect(result).toEqual({
        userId: 'user-1',
        email: registerDto.email,
        status: UserStatus.PENDING,
        requireConfirmation: true,
      });
      expect(result).not.toHaveProperty('password');

      expect(userService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: registerDto.email,
          status: UserStatus.PENDING,
        }),
      );

      const createArg = userService.create.mock.calls[0][0];
      expect(createArg.password).not.toBe(registerDto.password);

      expect(otpService.createOtp).toHaveBeenCalledWith('user-1');
    });

    it('creates ACTIVE user and skips OTP when confirmation is disabled', async () => {
      userService.findByEmail.mockResolvedValue(null);
      prisma.systemSetting.findFirst.mockResolvedValue({
        requireEmailConfirmationRegistration: false,
      });
      userService.create.mockResolvedValue({
        id: 'user-2',
        email: registerDto.email,
        status: UserStatus.ACTIVE,
      });

      const result = await authService.register(registerDto);

      expect(result).toEqual({
        userId: 'user-2',
        email: registerDto.email,
        status: UserStatus.ACTIVE,
        requireConfirmation: false,
      });
      expect(otpService.createOtp).not.toHaveBeenCalled();
    });

    it('throws ConflictException when email already exists', async () => {
      userService.findByEmail.mockResolvedValue({
        id: 'existing',
        email: registerDto.email,
      });

      await expect(authService.register(registerDto)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(userService.create).not.toHaveBeenCalled();
      expect(otpService.createOtp).not.toHaveBeenCalled();
    });

    it('throws InternalServerErrorException when settings are missing', async () => {
      userService.findByEmail.mockResolvedValue(null);
      prisma.systemSetting.findFirst.mockResolvedValue(null);

      await expect(authService.register(registerDto)).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
      expect(userService.create).not.toHaveBeenCalled();
    });
  });

  describe('confirmEmail', () => {
    const confirmDto: ConfirmEmailDto = {
      userId: 'user-1',
      code: '123456',
    };

    it('activates user when OTP is valid', async () => {
      userService.findOne.mockResolvedValue({
        id: 'user-1',
        email: 'user@test.com',
        status: UserStatus.PENDING,
      });
      otpService.verifyOtp.mockResolvedValue(true);
      userService.updateStatus.mockResolvedValue({
        id: 'user-1',
        email: 'user@test.com',
        status: UserStatus.ACTIVE,
      });

      const result = await authService.confirmEmail(confirmDto);

      expect(result).toEqual({
        userId: 'user-1',
        email: 'user@test.com',
        status: UserStatus.ACTIVE,
      });
      expect(otpService.verifyOtp).toHaveBeenCalledWith('user-1', '123456');
      expect(userService.updateStatus).toHaveBeenCalledWith(
        'user-1',
        UserStatus.ACTIVE,
      );
    });

    it('throws NotFoundException when user does not exist', async () => {
      userService.findOne.mockResolvedValue(null);

      await expect(authService.confirmEmail(confirmDto)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(otpService.verifyOtp).not.toHaveBeenCalled();
      expect(userService.updateStatus).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when user is not PENDING', async () => {
      userService.findOne.mockResolvedValue({
        id: 'user-1',
        email: 'user@test.com',
        status: UserStatus.ACTIVE,
      });

      await expect(authService.confirmEmail(confirmDto)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(otpService.verifyOtp).not.toHaveBeenCalled();
    });

    it('throws when OTP verification fails and does not update status', async () => {
      userService.findOne.mockResolvedValue({
        id: 'user-1',
        email: 'user@test.com',
        status: UserStatus.PENDING,
      });
      otpService.verifyOtp.mockRejectedValue(
        new BadRequestException('Invalid or expired verification code.'),
      );

      await expect(authService.confirmEmail(confirmDto)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(userService.updateStatus).not.toHaveBeenCalled();
    });
  });
});
