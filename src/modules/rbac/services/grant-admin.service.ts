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

  async create(dto: CreateGrantDto) {
    await this.assertActionAllowed(dto.permissionId, dto.actions);

    const grant = await this.prisma.grant.create({
      data: dto,
    });

    await this.rbacService.buildMatrix();
    return grant;
  }

  async update(id: string, dto: UpdateGrantDto) {
    const existing = await this.prisma.grant.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Grant not found');

    await this.assertActionAllowed(existing.permissionId, dto.actions);

    const grant = await this.prisma.grant.update({
      where: { id },
      data: { actions: dto.actions },
    });
    await this.rbacService.buildMatrix();
    return grant;
  }

  async remove(id: string) {
    await this.prisma.grant.delete({ where: { id } });
    await this.rbacService.buildMatrix();
    return { ok: true };
  }
}
