import { REDIS_CLIENT } from '@/common/redis/redis.module.js';
import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Redis } from 'ioredis';

interface OtpData {
  code: string;
  attempts: number;
  newEmail?: string;
}

@Injectable()
export class OtpService {
  private readonly OTP_TTL = 600;
  private readonly RESEND_TTL = 60;
  private readonly MAX_ATTEMPTS = 5;

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  private generateCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  async createOtp(
    userId: string,
    purpose: 'registration' | 'email-change',
    newEmail?: string,
  ): Promise<string> {
    const rateLimitKey = `ratelimit:otp:${purpose}:${userId}`;
    const isRateLimited = await this.redis.get(rateLimitKey);

    if (isRateLimited) {
      throw new HttpException(
        'Verification code already sent. Please wait 60 seconds.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const code = this.generateCode();
    const otpKey = `otp:${purpose}:${userId}`;
    const data: OtpData = { code, attempts: 0, ...(newEmail && { newEmail }) };

    await this.redis.set(otpKey, JSON.stringify(data), 'EX', this.OTP_TTL);
    await this.redis.set(rateLimitKey, '1', 'EX', this.RESEND_TTL);

    return code;
  }

  async verifyOtp<T extends string | boolean>(
    userId: string,
    inputCode: string,
    purpose: 'registration' | 'email-change',
  ): Promise<T> {
    const otpKey = `otp:${purpose}:${userId}`;
    const rawData = await this.redis.get(otpKey);

    if (!rawData) {
      throw new BadRequestException(
        'Verification code expired or does not exist.',
      );
    }

    const data: OtpData = JSON.parse(rawData);

    if (data.attempts >= this.MAX_ATTEMPTS) {
      await this.redis.del(otpKey);
      throw new BadRequestException(
        'Maximum verification attempts exceeded. Please request a new code.',
      );
    }

    if (data.code !== inputCode) {
      data.attempts += 1;
      const ttl = await this.redis.ttl(otpKey);
      if (ttl > 0) {
        await this.redis.set(otpKey, JSON.stringify(data), 'EX', ttl);
        throw new BadRequestException('Invalid or expired verification code.');
      }
      throw new BadRequestException('Verification code is does not correct');
    }

    if (purpose === 'email-change') {
      if (!data.newEmail) {
        throw new BadRequestException(
          'Verification code expires or does not exist',
        );
      }
      await this.redis.del(otpKey);
      return data.newEmail as T;
    }

    await this.redis.del(otpKey);
    return true as T;
  }
}
