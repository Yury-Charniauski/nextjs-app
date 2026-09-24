import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard.js';
import { Roles } from '@/modules/rbac/decorators/roles.js';
import { CreatePermissionDto } from '@/modules/rbac/dto/create-permission.dto.js';
import { UpdatePermissionDto } from '@/modules/rbac/dto/update-permission.dto.js';
import { RolesGuard } from '@/modules/rbac/guards/roles.guard.js';
import { PermissionAdminService } from '@/modules/rbac/services/permission-admin.service.js';
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
@Controller('admin/rbac/permissions')
export class PermissionController {
  constructor(private readonly permissionService: PermissionAdminService) {}

  @Get()
  findAll() {
    return this.permissionService.findAll();
  }

  @Post()
  create(@Body() dto: CreatePermissionDto) {
    return this.permissionService.create(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePermissionDto) {
    return this.permissionService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.permissionService.remove(id);
  }
}
