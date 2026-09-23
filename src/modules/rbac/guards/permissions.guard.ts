import { PERMISSION_KEY } from '@/modules/rbac/decorators/require-permission.js';
import { RbacService } from '@/modules/rbac/services/rbac.service.js';
import {
  AuthRequest,
  PermissionMeta,
} from '@/modules/rbac/types/rbac.types.js';
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class PermissionGuard implements CanActivate {
  private readonly logger: Logger = new Logger(PermissionGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly rbacService: RbacService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const meta = this.reflector.getAllAndOverride<PermissionMeta>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!meta) return true;

    const req = context.switchToHttp().getRequest<AuthRequest>();
    const userId = req.user?.userId;

    if (!userId) {
      throw new ForbiddenException('Access is forbidden');
    }

    const allowed = await this.rbacService.can(
      userId,
      meta.permission,
      meta.action,
    );

    if (!allowed) {
      this.logger.warn(
        `Access denied: userId=${userId}, permission=${meta.permission}, action=${meta.action}`,
      );

      throw new ForbiddenException('Access is forbidden');
    }
    return true;
  }
}
