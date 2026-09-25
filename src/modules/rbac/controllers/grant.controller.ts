import { CurrentUser } from '@/common/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard.js';
import { Roles } from '@/modules/rbac/decorators/roles.js';
import { CreateGrantDto } from '@/modules/rbac/dto/create-grant.dto.js';
import { UpdateGrantDto } from '@/modules/rbac/dto/update-grant.dto.js';
import { RolesGuard } from '@/modules/rbac/guards/roles.guard.js';
import { GrantAdminService } from '@/modules/rbac/services/grant-admin.service.js';
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
@Controller('/admin/rbac/grants')
export class GrantController {
  constructor(private readonly grantService: GrantAdminService) {}

  @Get()
  findAll() {
    return this.grantService.findAll();
  }

  @Post()
  create(@Body() dto: CreateGrantDto, @CurrentUser() user: { userId: string }) {
    return this.grantService.create(dto, user.userId);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateGrantDto,
    @CurrentUser() user: { userId: string },
  ) {
    return this.grantService.update(id, dto, user.userId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: { userId: string }) {
    return this.grantService.remove(id, user.userId);
  }
}
