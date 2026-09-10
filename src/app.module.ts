import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from "./prisma/prisma.module.js";
import { UserModule } from "./modules/users/user.module.js";
import { AuthModule } from "@/modules/auth/auth.module.js";
import { RedisModule } from "@/common/redis/redis.module.js";

@Module({
  imports: [PrismaModule, UserModule, AuthModule, RedisModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
