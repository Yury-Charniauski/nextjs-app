import { ROLES_KEY } from '@/modules/rbac/decorators/roles.js';
import { RbacService } from '@/modules/rbac/services/rbac.service.js';
import { AuthRequest } from '@/modules/rbac/types/rbac.types.js';
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger: Logger = new Logger(RolesGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly rbacService: RbacService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) return true;

    const req = context.switchToHttp().getRequest<AuthRequest>();
    const userId = req.user?.userId;

    if (!userId) {
      throw new ForbiddenException('Access is forbidden');
    }

    const userRoles = await this.rbacService.getUserRole(userId);

    const hasRole = requiredRoles.some((r) => userRoles.includes(r));

    if (!hasRole) {
      this.logger.warn(
        `Access denied: userId=${userId}, required roles: ${requiredRoles.join(',')}`,
      );

      throw new ForbiddenException('Access is forbidden');
		}
		

		return true;
  }
}
