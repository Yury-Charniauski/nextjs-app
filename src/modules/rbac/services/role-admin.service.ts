import { AuditService } from '@/common/audit/audit.service.js';
import { CreateRoleDto } from '@/modules/rbac/dto/create-role.dto.js';
import { UpdateRoleDto } from '@/modules/rbac/dto/update-role.dto.js';
import { RbacService } from '@/modules/rbac/services/rbac.service.js';
import { PrismaService } from '@/prisma/prisma.service.js';
import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

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

  async create(dto: CreateRoleDto) {
    const role = await this.prisma.$transaction(async (tx) => {
      const created = await tx.role.create({
        data: dto,
      });

      await this.auditService.log(
        {
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

  async update(id: string, dto: UpdateRoleDto) {
    const updatedRole = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.role.update({
        where: {
          id,
        },
        data: dto,
      });

      await this.auditService.log(
        {
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

  async remove(id: string) {
    await this.prisma.$transaction(async (tx) => {
      const role = await tx.role.findUnique({
        where: { id },
        include: {
          _count: {
            select: {
              grants: true,
              userRoles: true,
            },
          },
        },
      });

      if (!role) {
        throw new NotFoundException('Role not found');
      }

      if (role._count.grants !== 0 || role._count.userRoles !== 0) {
        throw new ConflictException('Role is in use');
      }

      await tx.role.delete({
        where: {
          id,
        },
      });

      await this.auditService.log(
        {
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
