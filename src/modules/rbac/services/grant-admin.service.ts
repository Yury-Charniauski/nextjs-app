import { AuditService } from '@/common/audit/audit.service.js';
import { CreateGrantDto } from '@/modules/rbac/dto/create-grant.dto.js';
import { UpdateGrantDto } from '@/modules/rbac/dto/update-grant.dto.js';
import { RbacService } from '@/modules/rbac/services/rbac.service.js';
import { PrismaService } from '@/prisma/prisma.service.js';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

@Injectable()
export class GrantAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rbacService: RbacService,
    private readonly auditService: AuditService,
  ) {}

  private async assertActionAllowed(permissionId: string, actions: string[]) {
    const permission = await this.prisma.permission.findUnique({
      where: {
        id: permissionId,
      },
    });

    if (!permission) {
      throw new NotFoundException('Permission not found');
    }

    const invalid = actions.filter((a) => !permission.actions.includes(a));

    if (invalid.length > 0) {
      throw new BadRequestException(
        `Action not allowed for this permission ${invalid.join(', ')}`,
      );
    }
  }

  findAll() {
    return this.prisma.grant.findMany();
  }

  async create(dto: CreateGrantDto, actorId: string) {
    await this.assertActionAllowed(dto.permissionId, dto.actions);

    const grant = await this.prisma.$transaction(async (tx) => {
      const created = await tx.grant.create({
        data: dto,
      });

      await this.auditService.log(
        {
          actorId,
          action: 'create',
          entity: 'grant',
          entityId: created.id,
          metadata: { actions: created.actions },
        },
        tx,
      );

      return created;
    });

    await this.rbacService.buildMatrix();
    return grant;
  }

  async update(id: string, dto: UpdateGrantDto, actorId: string) {
    const existing = await this.prisma.grant.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Grant not found');

    await this.assertActionAllowed(existing.permissionId, dto.actions);

    const grant = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.grant.update({
        where: { id },
        data: { actions: dto.actions },
      });

      await this.auditService.log(
        {
          actorId,
          action: 'update',
          entity: 'grant',
          entityId: updated.id,
          metadata: { actions: updated.actions },
        },
        tx,
      );

      return updated;
    });
    await this.rbacService.buildMatrix();
    return grant;
  }

  async remove(id: string, actorId: string) {
    await this.prisma.$transaction(async (tx) => {
      await tx.grant.delete({ where: { id } });

      await this.auditService.log(
        {
          actorId,
          action: 'delete',
          entity: 'grant',
          entityId: id,
        },
        tx,
      );
    });
    await this.rbacService.buildMatrix();
    return { ok: true };
  }
}
