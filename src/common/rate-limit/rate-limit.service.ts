import { REDIS_CLIENT } from '@/common/redis/redis.module.js';
import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';

@Injectable()
export class RateLimitService {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async consume(key: string, ttlSeconds: number = 60): Promise<void> {
    const exist = await this.redis.get(key);

    if (exist) {
      throw new HttpException('Too many request', HttpStatus.TOO_MANY_REQUESTS);
    }

    await this.redis.set(key, '1', 'EX', ttlSeconds);
  }
}
