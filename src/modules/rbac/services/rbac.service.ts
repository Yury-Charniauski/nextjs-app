import { Logger, OnModuleInit } from '@nestjs/common';
import { REDIS_CLIENT } from '@/common/redis/redis.module.js';
import { PrismaService } from '@/prisma/prisma.service.js';
import { Inject, Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';
import { TMatrix } from "@/modules/rbac/types/rbac.types.js";

@Injectable()
export class RbacService implements OnModuleInit {
  private readonly logger: Logger = new Logger(RbacService.name);
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async onModuleInit() {
    await this.buildMatrix();
  }

  async buildMatrix() {
    const start = Date.now();
    const matrix: TMatrix = {};

    const roles = await this.prisma.role.findMany({
      include: {
        grants: {
          include: {
            permission: true,
          },
        },
      },
    });

    for (const role of roles) {
      matrix[role.name] = {};

      for (const grant of role.grants) {
        const permissionName = grant.permission.name;

        matrix[role.name][permissionName] =
          grant.actions.length === 0 ? '*' : grant.actions;
      }
    }

    await this.redis.set('rbac:matrix', JSON.stringify(matrix));
    this.logger.log(`RBAC matrix rebuild: duration=${Date.now() - start}`);

    return matrix;
  }

  async getMatrix(): Promise<TMatrix> {
    const raw = await this.redis.get('rbac:matrix');
    let matrix: TMatrix | null = raw ? JSON.parse(raw) : null;

    if (!matrix) {
      matrix = await this.buildMatrix();
    }

    return matrix;
  }

  async getUserRole(userId: string) {
    const userRoles = await this.prisma.userRole.findMany({
      where: {
        userId,
      },
      include: {
        role: true,
      },
    });
    return userRoles.map((r) => r.role.name);
  }

  async can(userId: string, permission: string, action: string) {
    const roles = await this.getUserRole(userId);

    if (roles.length === 0) return false;

    const matrix = await this.getMatrix();

    for (const role of roles) {
      const entry = matrix[role]?.[permission];
      if (entry === '*' || (Array.isArray(entry) && entry.includes(action))) {
        return true;
      }
    }

    return false;
  }
}
