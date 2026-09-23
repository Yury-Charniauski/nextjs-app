import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { UserModule } from './modules/users/user.module.js';
import { AuthModule } from '@/modules/auth/auth.module.js';
import { RedisModule } from '@/common/redis/redis.module.js';
import { MailerModule } from '@/common/mailer/mailer.module.js';
import { RateLimitModule } from '@/common/rate-limit/rate-limit.module.js';
import { RbacModule } from "@/modules/rbac/rbac.module.js";

@Module({
  imports: [
    PrismaModule,
    UserModule,
    AuthModule,
    RedisModule,
    MailerModule,
    RateLimitModule,
    RbacModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
