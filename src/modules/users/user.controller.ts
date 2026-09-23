import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { UserService } from './user.service.js';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard.js';
import { type Request } from 'express';
import { PermissionGuard } from '@/modules/rbac/guards/permissions.guard.js';
import { RequirePermission } from '@/modules/rbac/decorators/require-permission.js';
// import { CreateUserDto } from "./dto/create-user.dto.js";

type AuthRequest = Request & { user: { userId: string } };

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  // @Post()
  // create(@Body() createUserDto: CreateUserDto) {
  // 	return this.userService.create(createUserDto)
  // }
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

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return await this.userService.findOne(id);
  }
}
