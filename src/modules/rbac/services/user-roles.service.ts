import { AuditService } from '@/common/audit/audit.service.js';
import { PrismaService } from '@/prisma/prisma.service.js';
import { Injectable, NotFoundException } from '@nestjs/common';

@Injectable()
export class UserRoleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  findAll(userId: string) {
    return this.prisma.userRole.findMany({
      where: {
        userId,
      },
      include: {
        role: true,
      },
    });
  }

  async assign(userId: string, roleId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role) throw new NotFoundException('Role not found');

    const userRole = await this.prisma.$transaction(async (tx) => {
      const created = await tx.userRole.create({
        data: {
          roleId,
          userId,
        },
      });

      await this.auditService.log(
        {
          action: 'create',
          entity: 'userRole',
          entityId: userId,
          metadata: { roleId },
        },
        tx,
      );
      return created;
    });

    return userRole;
  }

  async revoke(userId: string, roleId: string) {
    await this.prisma.$transaction(async (tx) => {
      await tx.userRole.delete({
        where: {
          userId_roleId: { userId, roleId },
        },
      });

      await this.auditService.log(
        {
          action: 'delete',
          entity: 'userRole',
          entityId: userId,
          metadata: { roleId },
        },
        tx,
      );
    });

    return { ok: true };
  }
}
