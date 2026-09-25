import { AuditService } from '@/common/audit/audit.service.js';
import { CreatePermissionDto } from '@/modules/rbac/dto/create-permission.dto.js';
import { UpdatePermissionDto } from '@/modules/rbac/dto/update-permission.dto.js';
import { RbacService } from '@/modules/rbac/services/rbac.service.js';
import { PrismaService } from '@/prisma/prisma.service.js';
import { Injectable } from '@nestjs/common';

@Injectable()
export class PermissionAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rbacService: RbacService,
    private readonly auditService: AuditService,
  ) {}

  findAll() {
    return this.prisma.permission.findMany();
  }

  async create(dto: CreatePermissionDto, actorId: string) {
    const permission = await this.prisma.$transaction(async (tx) => {
      const created = await tx.permission.create({
        data: dto,
      });

      await this.auditService.log(
        {
          actorId,
          action: 'create',
          entity: 'permission',
          entityId: created.id,
          metadata: { name: created.name },
        },
        tx,
      );

      return created;
    });

    await this.rbacService.buildMatrix();
    return permission;
  }

  async update(id: string, dto: UpdatePermissionDto, actorId: string) {
    const updatedPermission = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.permission.update({
        where: {
          id,
        },
        data: dto,
      });

      await this.auditService.log(
        {
          actorId,
          action: 'update',
          entity: 'permission',
          entityId: updated.id,
          metadata: { name: updated.name },
        },
        tx,
      );

      return updated;
    });
    await this.rbacService.buildMatrix();
    return updatedPermission;
  }

  async remove(id: string, actorId: string) {
    await this.prisma.$transaction(async (tx) => {
      await tx.permission.delete({
        where: {
          id,
        },
      });

      await this.auditService.log(
        {
          actorId,
          action: 'delete',
          entity: 'permission',
          entityId: id,
        },
        tx,
      );
    });
    await this.rbacService.buildMatrix();
    return { ok: true };
  }
}
