import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard.js';
import { RequirePermission } from '@/modules/rbac/decorators/require-permission.js';
import { PermissionGuard } from '@/modules/rbac/guards/permissions.guard.js';
import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { type Request } from 'express';
import { UserService } from './user.service.js';

type AuthRequest = Request & { user: { userId: string } };

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission('users', 'read')
  @Get()
  findAll() {
    return this.userService.findAll();
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getProfile(@Req() req: AuthRequest) {
    return await this.userService.findOne(req.user.userId);
  }
}
