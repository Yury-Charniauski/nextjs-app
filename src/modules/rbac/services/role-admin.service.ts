import { CreateRoleDto } from '@/modules/rbac/dto/create-role.dto.js';
import { UpdateRoleDto } from '@/modules/rbac/dto/update-role.dto.js';
import { RbacService } from '@/modules/rbac/services/rbac.service.js';
import { PrismaService } from '@/prisma/prisma.service.js';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class RoleAdminService {
  logger: Logger = new Logger(RoleAdminService.name)
  constructor(
    private readonly prisma: PrismaService,
    private readonly rbacService: RbacService,
  ) {}

  findAll() {
    return this.prisma.role.findMany();
  }

  async create(dto: CreateRoleDto) {
    const role = await this.prisma.role.create({
      data: dto,
    });
    await this.rbacService.buildMatrix();
    return role;
  }

  async update(id: string, dto: UpdateRoleDto) {
    const updatedRole = await this.prisma.role.update({
      where: {
        id,
      },
      data: dto,
    });

    await this.rbacService.buildMatrix();
    return updatedRole;
  }

  async remove(id: string) {
    await this.prisma.role.delete({
      where: {
        id,
      },
    });

    await this.rbacService.buildMatrix();
    return { ok: true };
  }
}
