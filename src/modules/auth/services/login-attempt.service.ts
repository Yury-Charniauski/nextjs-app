import { AuditService } from '@/common/audit/audit.service.js';
import { RateLimitService } from '@/common/rate-limit/rate-limit.service.js';
import { REDIS_CLIENT } from '@/common/redis/redis.module.js';
import {
  LoginAttemptData,
  LoginAttemptRes,
} from '@/modules/auth/types/login-attempt.types.js';
import { generateOtpCode } from '@/modules/auth/utility/generate-otp-code.js';
import {
  BadRequestException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Redis } from 'ioredis';
import { randomUUID } from 'node:crypto';

@Injectable()
export class LoginAttemptService {
  private readonly TTL_SECONDS = 600;
  private readonly LOGIN_ATTEMPT_KEY = 'login_attempt:';
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly auditService: AuditService,
    private readonly rateLimitService: RateLimitService,
  ) {}

  async createLoginAttempt(userData: LoginAttemptData) {
    const loginAttemptId = randomUUID();
    const loginAttemptKey = `${this.LOGIN_ATTEMPT_KEY}${loginAttemptId}`;

    const code = generateOtpCode();

    await this.redis.set(
      loginAttemptKey,
      JSON.stringify({
        userId: userData.userId,
        code,
        attempts: 0,
        ip: userData.ip ?? null,
        userAgent: userData.userAgent ?? null,
      }),
      'EX',
      this.TTL_SECONDS,
    );

    return { code, loginAttemptId };
  }

  async confirmLoginOpt(
    loginAttemptId: string,
    code: string,
    ip?: string,
    userAgent?: string,
  ) {
    const loginAttemptKey = `${this.LOGIN_ATTEMPT_KEY}${loginAttemptId}`;
    const rawData = await this.redis.get(loginAttemptKey);

    if (!rawData) {
      await this.auditService.authLog({
        action: 'LOGIN_2FA_FAILED',
        actorId: null,
      });

      throw new BadRequestException('Verification code expired or invalid');
    }

    const data: LoginAttemptRes = JSON.parse(rawData);
    const currentIp = ip ?? null;
    const currentUserAgent = userAgent ?? null;

    if (currentIp !== data.ip || currentUserAgent !== data.userAgent) {
      await this.auditService.authLog({
        action: 'LOGIN_2FA_FAILED',
        entityId: data.userId,
        actorId: data.userId,
        metadata: { reason: 'wrong_ip_of_userAgent' },
      });

      throw new BadRequestException('Wrong data');
    }

    if (data.attempts >= 5) {
      await this.auditService.authLog({
        action: 'LOGIN_2FA_FAILED',
        entityId: data.userId,
        actorId: data.userId,
        metadata: { reason: 'max_attempts' },
      });

      await this.redis.del(loginAttemptKey);
      throw new BadRequestException('Maximum verification attempts exceeded');
    }

    if (data.code !== code) {
      const ttl = await this.redis.ttl(loginAttemptKey);

      if (ttl > 0) {
        await this.redis.set(
          loginAttemptKey,
          JSON.stringify({ ...data, attempts: data.attempts + 1 }),
          'EX',
          ttl,
        );

        await this.auditService.authLog({
          action: 'LOGIN_2FA_FAILED',
          entityId: data.userId,
          actorId: data.userId,
          metadata: { reason: 'invalid_code' },
        });

        throw new UnauthorizedException('Verification code invalid');
      }

      await this.auditService.authLog({
        action: 'LOGIN_2FA_FAILED',
        entityId: data.userId,
        actorId: data.userId,
        metadata: { reason: 'expired' },
      });

      await this.redis.del(loginAttemptKey);
      throw new BadRequestException('Login session expired or invalid');
    }

    await this.redis.del(loginAttemptKey);
    return data.userId;
  }

  async replaceLoginCode(loginAttemptId: string) {
    const loginAttemptKey = `${this.LOGIN_ATTEMPT_KEY}${loginAttemptId}`;
    const rawData = await this.redis.get(loginAttemptKey);

    if (!rawData) {
      return null;
    }

    const { userId, ip, userAgent, attempts }: LoginAttemptRes =
      JSON.parse(rawData);

    await this.rateLimitService.consume(`ratelimit:otp:login:${userId}`);

    const newCode = generateOtpCode();
    await this.redis.set(
      loginAttemptKey,
      JSON.stringify({ userId, attempts, userAgent, ip, code: newCode }),
      'EX',
      this.TTL_SECONDS,
    );

    return { code: newCode, userId: userId };
  }
}
