import { AuditService } from '@/common/audit/audit.service.js';
import { CreateRoleDto } from '@/modules/rbac/dto/create-role.dto.js';
import { UpdateRoleDto } from '@/modules/rbac/dto/update-role.dto.js';
import { RbacService } from '@/modules/rbac/services/rbac.service.js';
import { PrismaService } from '@/prisma/prisma.service.js';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class RoleAdminService {
  logger: Logger = new Logger(RoleAdminService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly rbacService: RbacService,
    private readonly auditService: AuditService,
  ) {}

  findAll() {
    return this.prisma.role.findMany();
  }

  async create(dto: CreateRoleDto, actorId: string) {
    const role = await this.prisma.$transaction(async (tx) => {
      const created = await tx.role.create({
        data: dto,
      });

      await this.auditService.log(
        {
          actorId,
          action: 'create',
          entity: 'role',
          entityId: created.id,
          metadata: { name: created.name },
        },
        tx,
      );

      return created;
    });

    await this.rbacService.buildMatrix();
    return role;
  }

  async update(id: string, dto: UpdateRoleDto, actorId: string) {
    const updatedRole = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.role.update({
        where: {
          id,
        },
        data: dto,
      });

      await this.auditService.log(
        {
          actorId,
          action: 'update',
          entity: 'role',
          entityId: updated.id,
          metadata: { name: updated.name },
        },
        tx,
      );
      return updated;
    });

    await this.rbacService.buildMatrix();
    return updatedRole;
  }

  async remove(id: string, actorId: string) {
    await this.prisma.$transaction(async (tx) => {
      await tx.role.delete({
        where: {
          id,
        },
      });

      await this.auditService.log(
        {
          actorId,
          action: 'delete',
          entity: 'role',
          entityId: id,
        },
        tx,
      );
    });

    await this.rbacService.buildMatrix();
    return { ok: true };
  }
}
