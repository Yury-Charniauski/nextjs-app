import { AuditService } from '@/common/audit/audit.service.js';
import { MailerService } from '@/common/mailer/mailer.service.js';
import { RateLimitService } from '@/common/rate-limit/rate-limit.service.js';
import { ConfirmEmailDto } from '@/modules/auth/dto/confirm-email.dto.js';
import { LoginDto } from '@/modules/auth/dto/login.dto.js';
import { RegisterDto } from '@/modules/auth/dto/register.dto.js';
import { OtpService } from '@/modules/auth/services/otp.service.js';
import { UserService } from '@/modules/users/user.service.js';
import { PrismaService } from '@/prisma/prisma.service.js';
import { UserStatus } from '@/generated/prisma/enums.js';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service.js';

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

  const mailerService = {
    sendOtp: vi.fn(),
  };

  const rateLimitService = {
    consume: vi.fn(),
    isLoginBlocked: vi.fn().mockResolvedValue(false),
    recordLoginFailure: vi.fn().mockResolvedValue(false),
    clearLoginFailure: vi.fn().mockResolvedValue(undefined),
  };

  const jwtService = {
    sign: vi.fn(),
    verify: vi.fn(),
  };

  const auditService = {
    authLog: vi.fn(),
    log: vi.fn(),
  };

  const registerDto: RegisterDto = {
    email: 'user@test.com',
    password: 'Password1',
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    rateLimitService.isLoginBlocked.mockResolvedValue(false);
    rateLimitService.recordLoginFailure.mockResolvedValue(false);
    rateLimitService.clearLoginFailure.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UserService, useValue: userService },
        { provide: OtpService, useValue: otpService },
        { provide: PrismaService, useValue: prisma },
        { provide: MailerService, useValue: mailerService },
        { provide: RateLimitService, useValue: rateLimitService },
        { provide: JwtService, useValue: jwtService },
        { provide: AuditService, useValue: auditService },
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

      expect(otpService.createOtp).toHaveBeenCalledWith(
        'user-1',
        'registration',
      );
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
      expect(otpService.verifyOtp).toHaveBeenCalledWith(
        'user-1',
        '123456',
        'registration',
      );
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

  describe('login', () => {
    const loginDto: LoginDto = {
      email: 'User@test.com',
      password: 'Password1',
    };
    const normalizedEmail = 'user@test.com';
    let passwordHash: string;

    beforeAll(async () => {
      passwordHash = await bcrypt.hash(loginDto.password, 4);
    });

    function activeUser(status: UserStatus = UserStatus.ACTIVE) {
      return {
        id: 'user-1',
        email: normalizedEmail,
        password: passwordHash,
        status,
      };
    }

    it('returns 401 and LOGIN_FAILED when the email is unknown', async () => {
      userService.findByEmail.mockResolvedValue(null);

      await expect(authService.login(loginDto)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );

      expect(userService.findByEmail).toHaveBeenCalledWith(normalizedEmail);
      expect(auditService.authLog).toHaveBeenCalledWith({
        action: 'LOGIN_FAILED',
        actorId: null,
        metadata: { email: normalizedEmail, reason: 'invalid_credentials' },
      });
      expect(jwtService.sign).not.toHaveBeenCalled();
      expect(rateLimitService.recordLoginFailure).toHaveBeenCalledWith(
        normalizedEmail,
        undefined,
      );
      expect(rateLimitService.clearLoginFailure).not.toHaveBeenCalled();
    });

    it('returns 401 and LOGIN_FAILED when the password does not match', async () => {
      userService.findByEmail.mockResolvedValue(activeUser());

      await expect(
        authService.login({ ...loginDto, password: 'wrong-password' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      expect(auditService.authLog).toHaveBeenCalledWith({
        action: 'LOGIN_FAILED',
        actorId: 'user-1',
        entityId: 'user-1',
        metadata: { email: normalizedEmail, reason: 'invalid_credentials' },
      });
      expect(jwtService.sign).not.toHaveBeenCalled();
      expect(rateLimitService.recordLoginFailure).toHaveBeenCalledWith(
        normalizedEmail,
        undefined,
      );
    });

    it.each([UserStatus.PENDING, UserStatus.BLOCKED])(
      'returns 403 and LOGIN_FAILED when the account is %s',
      async (status) => {
        userService.findByEmail.mockResolvedValue(activeUser(status));

        await expect(authService.login(loginDto)).rejects.toBeInstanceOf(
          ForbiddenException,
        );

        expect(auditService.authLog).toHaveBeenCalledWith({
          action: 'LOGIN_FAILED',
          actorId: 'user-1',
          entityId: 'user-1',
          metadata: { email: normalizedEmail, reason: status },
        });
        expect(jwtService.sign).not.toHaveBeenCalled();
        expect(rateLimitService.recordLoginFailure).not.toHaveBeenCalled();
      },
    );

    it('returns tokens and writes LOGIN_SUCCESS for an active user', async () => {
      userService.findByEmail.mockResolvedValue(activeUser());
      jwtService.sign.mockImplementation(
        (payload: { type: string }) => `${payload.type}-token`,
      );

      const result = await authService.login(loginDto);

      expect(result).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
      expect(jwtService.sign).toHaveBeenNthCalledWith(1, {
        sub: 'user-1',
        type: 'access',
      });
      expect(jwtService.sign).toHaveBeenNthCalledWith(
        2,
        { sub: 'user-1', type: 'refresh' },
        {
          secret: process.env.JWT_REFRESH_SECRET,
          expiresIn: '30d',
        },
      );
      expect(auditService.authLog).toHaveBeenCalledWith({
        action: 'LOGIN_SUCCESS',
        actorId: 'user-1',
        entityId: 'user-1',
        metadata: { email: normalizedEmail },
      });
      expect(auditService.authLog.mock.calls[0][0].metadata).not.toHaveProperty(
        'password',
      );
      expect(rateLimitService.clearLoginFailure).toHaveBeenCalledWith(
        normalizedEmail,
      );
    });

    it('returns 429 and LOGIN_LOCKOUT when the account is already blocked', async () => {
      userService.findByEmail.mockResolvedValue(activeUser());
      rateLimitService.isLoginBlocked.mockResolvedValue(true);

      const error = await authService
        .login(loginDto, '127.0.0.1')
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(
        HttpStatus.TOO_MANY_REQUESTS,
      );
      expect(rateLimitService.recordLoginFailure).not.toHaveBeenCalled();
      expect(auditService.authLog).toHaveBeenCalledWith({
        action: 'LOGIN_LOCKOUT',
        actorId: 'user-1',
        metadata: { email: normalizedEmail, ip: '127.0.0.1' },
      });
      expect(jwtService.sign).not.toHaveBeenCalled();
    });

    it('returns 429 and LOGIN_LOCKOUT when the fifth failure reaches the limit', async () => {
      userService.findByEmail.mockResolvedValue(activeUser());
      rateLimitService.recordLoginFailure.mockResolvedValue(true);

      const error = await authService
        .login({ ...loginDto, password: 'wrong-password' }, '127.0.0.1')
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(
        HttpStatus.TOO_MANY_REQUESTS,
      );
      expect(auditService.authLog).toHaveBeenNthCalledWith(1, {
        action: 'LOGIN_FAILED',
        actorId: 'user-1',
        entityId: 'user-1',
        metadata: { email: normalizedEmail, reason: 'invalid_credentials' },
      });
      expect(auditService.authLog).toHaveBeenNthCalledWith(2, {
        action: 'LOGIN_LOCKOUT',
        actorId: 'user-1',
        metadata: { email: normalizedEmail, ip: '127.0.0.1' },
      });
      expect(rateLimitService.recordLoginFailure).toHaveBeenCalledWith(
        normalizedEmail,
        '127.0.0.1',
      );
      expect(jwtService.sign).not.toHaveBeenCalled();
    });
  });
});
