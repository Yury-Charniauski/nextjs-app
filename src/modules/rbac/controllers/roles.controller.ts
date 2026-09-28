import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard.js';
import { Roles } from '@/modules/rbac/decorators/roles.js';
import { CreateRoleDto } from '@/modules/rbac/dto/create-role.dto.js';
import { UpdateRoleDto } from '@/modules/rbac/dto/update-role.dto.js';
import { RolesGuard } from '@/modules/rbac/guards/roles.guard.js';
import { RoleAdminService } from '@/modules/rbac/services/role-admin.service.js';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin/rbac/roles')
export class RolesController {
  constructor(private readonly roleAdmin: RoleAdminService) {}
  @Get()
  findAll() {
    return this.roleAdmin.findAll();
  }

  @Post()
  create(@Body() dto: CreateRoleDto) {
    return this.roleAdmin.create(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateRoleDto) {
    return this.roleAdmin.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.roleAdmin.remove(id);
  }
}
