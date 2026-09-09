import { AuthController } from '@/modules/auth/auth.controller.js';
import { AuthService } from '@/modules/auth/services/auth.service.js';
import { UserModule } from '@/modules/users/user.module.js';
import { Module } from '@nestjs/common';

@Module({
  imports: [UserModule],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
