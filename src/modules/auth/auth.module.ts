import { AuditModule } from '@/common/audit/audit.module.js';
import { AuthController } from '@/modules/auth/auth.controller.js';
import { jwtConfig } from '@/modules/auth/config/jwt.config.js';
import { AuthService } from '@/modules/auth/services/auth.service.js';
import { LoginAttemptService } from '@/modules/auth/services/login-attempt.service.js';
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
      secret: jwtConfig.access.secret,
      signOptions: {
        expiresIn: jwtConfig.access.expiresIn,
        issuer: jwtConfig.issuer,
        audience: jwtConfig.audience,
      },
    }),
    passportModule,
    AuditModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, OtpService, JwtStrategy, LoginAttemptService],
  exports: [passportModule, OtpService],
})
export class AuthModule {}
