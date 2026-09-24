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
  ) {}

  findAll() {
    return this.prisma.permission.findMany();
  }

  async create(dto: CreatePermissionDto) {
    const permission = await this.prisma.permission.create({
      data: dto,
    });

    await this.rbacService.buildMatrix();
    return permission;
  }

  async update(id: string, dto: UpdatePermissionDto) {
    const updatedPermission = await this.prisma.permission.update({
      where: {
        id,
      },
      data: dto,
    });

    await this.rbacService.buildMatrix();
    return updatedPermission;
  }

  async remove(id: string) {
    await this.prisma.permission.delete({
      where: {
        id,
      },
    });

    await this.rbacService.buildMatrix();
    return { ok: true };
  }
}
