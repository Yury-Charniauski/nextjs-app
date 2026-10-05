import { AuditService } from '@/common/audit/audit.service.js';
import { UserStatus } from '@/generated/prisma/enums.js';
import { jwtConfig } from '@/modules/auth/config/jwt.config.js';
import { TJwtServicePayload } from '@/modules/auth/types/jwt-service.js';
import { RbacService } from '@/modules/rbac/services/rbac.service.js';
import { UserService } from '@/modules/users/user.service.js';
import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly userService: UserService,
    private readonly rbacService: RbacService,
    private readonly auditService: AuditService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => req.cookies?.access_token ?? null,
      ]),
      secretOrKey: jwtConfig.access.secret,
      ignoreExpiration: false,
      issuer: jwtConfig.issuer,
      audience: jwtConfig.audience,
    });
  }

  async validate(payload: TJwtServicePayload) {
    if (payload.type !== 'access' || typeof payload.sub !== 'string') {
      throw new UnauthorizedException('Unauthorized user');
    }

    const user = await this.userService.findOne(payload.sub);

    if (!user) {
      await this.auditService.authLog({
        action: 'AUTH_DENIED',
        actorId: null,
        metadata: { reason: 'USER_NOT_FOUND' },
      });
      throw new ForbiddenException('Access is forbidden');
    }

    if (user.status === UserStatus.BLOCKED) {
      await this.auditService.authLog({
        action: 'AUTH_DENIED',
        actorId: user.id,
        entityId: user.id,
        metadata: { reason: 'USER_BLOCKED' },
      });
      throw new ForbiddenException('Access is forbidden');
    }

    if (user.status === UserStatus.PENDING) {
      await this.auditService.authLog({
        action: 'AUTH_DENIED',
        actorId: user.id,
        entityId: user.id,
        metadata: { reason: 'USER_PENDING' },
      });
      throw new ForbiddenException('Access is forbidden');
    }

    const roles = await this.rbacService.getUserRole(user.id);

    return { id: user.id, email: user.email, roles };
  }
}
