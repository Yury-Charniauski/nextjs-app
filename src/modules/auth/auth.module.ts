import { AuthController } from '@/modules/auth/auth.controller.js';
import { AuthService } from '@/modules/auth/services/auth.service.js';
import { OtpService } from '@/modules/auth/services/otp.service.js';
import { JwtStrategy } from '@/modules/auth/strategies/jwt.strategy.js';
import { UserModule } from '@/modules/users/user.module.js';
import { forwardRef, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

const passportModule = PassportModule.register({ defaultStrategy: 'jwt' });
@Module({
  imports: [
    forwardRef(() => UserModule),
    JwtModule.register({
      secret: process.env.JWT_ACCESS_SECRET,
      signOptions: { expiresIn: '15m' },
    }),
    passportModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, OtpService, JwtStrategy],
  exports: [passportModule],
})
export class AuthModule {}
