import { REDIS_CLIENT } from '@/common/redis/redis.module.js';
import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';

@Injectable()
export class RateLimitService {
  private readonly TTL_SECONDS = 900;
  private readonly LOGIN_LIMIT = 5;

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async consume(key: string, ttlSeconds: number = 60): Promise<void> {
    const exist = await this.redis.get(key);

    if (exist) {
      throw new HttpException('Too many request', HttpStatus.TOO_MANY_REQUESTS);
    }

    await this.redis.set(key, '1', 'EX', ttlSeconds);
  }

  async isLoginBlocked(email: string, ip?: string) {
    const emailKey = `ratelimit:login:email:${email}`;
    const ipKey = `ratelimit:login:ip:${ip}`;

    const failEmailCount = await this.redis.get(emailKey);
    const failIpCount = ip ? await this.redis.get(ipKey) : null;

    if (
      Number(failEmailCount) >= this.LOGIN_LIMIT ||
      (ip && Number(failIpCount) >= this.LOGIN_LIMIT)
    ) {
      return true;
    }

    return false;
  }

  async recordLoginFailure(email: string, ip?: string) {
    const emailKey = `ratelimit:login:email:${email}`;
    const ipKey = `ratelimit:login:ip:${ip}`;

    const failEmailCount = await this.redis.incr(emailKey);
    const failIpCount = ip ? await this.redis.incr(ipKey) : null;

    if (failEmailCount === 1) {
      await this.redis.expire(emailKey, this.TTL_SECONDS);
    }

    if (ip && failIpCount === 1) {
      await this.redis.expire(ipKey, this.TTL_SECONDS);
    }

    if (
      failEmailCount >= this.LOGIN_LIMIT ||
      (ip && failIpCount && failIpCount >= this.LOGIN_LIMIT)
    ) {
      return true;
    }

    return false;
  }

  async clearLoginFailure(email: string) {
    await this.redis.del(`ratelimit:login:email:${email}`);
  }
}
