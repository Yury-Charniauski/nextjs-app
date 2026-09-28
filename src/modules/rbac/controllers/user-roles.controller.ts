import { CurrentUser } from '@/common/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard.js';
import { Roles } from '@/modules/rbac/decorators/roles.js';
import { AssignRoleDto } from '@/modules/rbac/dto/assign-role.dto.js';
import { RolesGuard } from '@/modules/rbac/guards/roles.guard.js';
import { UserRoleService } from '@/modules/rbac/services/user-roles.service.js';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('/admin/rbac/users')
export class UserRoleController {
  constructor(private readonly userRoleService: UserRoleService) {}

  @Get(':userId/roles')
  findAll(@Param('userId') userId: string) {
    return this.userRoleService.findAll(userId);
  }

  @Post(':userId/roles')
  assign(
    @Param('userId') userId: string,
    @Body() dto: AssignRoleDto,
    @CurrentUser() user: { userId: string },
  ) {
    return this.userRoleService.assign(userId, dto.roleId, user.userId);
  }

  @Delete(':userId/roles/:roleId')
  revoke(
    @Param('userId') userId: string,
    @Param('roleId') roleId: string,
    @CurrentUser() user: { userId: string },
  ) {
    return this.userRoleService.revoke(userId, roleId, user.userId);
  }

}
