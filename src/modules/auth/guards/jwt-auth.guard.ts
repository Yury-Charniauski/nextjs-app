import { AuditService } from '@/common/audit/audit.service.js';
import { TAuth } from '@/modules/auth/types/auth.types.js';
import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

class AuthDeniedException extends UnauthorizedException {
  constructor(readonly reason: 'JWT_EXPIRED' | 'INVALID_SIGNATURE') {
    super('Unauthorized user');
  }
}
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly auditService: AuditService) {
    super();
  }

  handleRequest<TAuth>(err: unknown, user: TAuth | false | null, info?: Error) {
    if (info?.name === 'TokenExpiredError') {
      // this.auditService.authLog({
      //   action: 'AUTH_DENIED',
      //   actorId: null,
      //   metadata: { reason: 'JWT_EXPIRED' },
      // });

      throw new AuthDeniedException('JWT_EXPIRED');
    }

    if (info?.name === 'JsonWebTokenError') {
      // await this.auditService.authLog({
      //   action: 'AUTH_DENIED',
      //   actorId: null,
      //   metadata: { reason: 'INVALID_SIGNATURE' },
      // });

      throw new AuthDeniedException('INVALID_SIGNATURE');
    }

    if (err) {
      throw err;
    }

    if (!user) {
      throw new UnauthorizedException('Unauthorized');
    }

    return user;
  }

  async canActivate(ctx: ExecutionContext) {
    try {
      return (await super.canActivate(ctx)) as boolean;
    } catch (err) {
      if (err instanceof AuthDeniedException) {
        await this.auditService.authLog({
          action: 'AUTH_DENIED',
          actorId: null,
          metadata: { reason: err.reason },
        });
      }

      throw err;
    }
  }
}
