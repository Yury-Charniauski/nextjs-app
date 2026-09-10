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

  async createOtp(userId: string): Promise<string> {
    const rateLimitKey = `ratelimit:otp:registration${userId}`;
    const isRateLimited = await this.redis.get(rateLimitKey);

    if (isRateLimited) {
      throw new HttpException(
        'Verification code already sent. Please wait 60 seconds.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const code = this.generateCode();
    const otpKey = `otp:registration:${userId}`;
    const data: OtpData = { code, attempts: 0 };

    await this.redis.set(otpKey, JSON.stringify(data), 'EX', this.OTP_TTL);
    await this.redis.set(rateLimitKey, '1', 'EX', this.RESEND_TTL);

    return code;
  }

  async verifyOtp(userId: string, inputCode: string): Promise<boolean> {
    const otpKey = `otp:registration:${userId}`;
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
        throw new BadRequestException(
          `Invalid code. Remaining attempts: ${this.MAX_ATTEMPTS - data.attempts}`,
        );
      }
    }

    await this.redis.del(otpKey);
    return true;
  }
}
