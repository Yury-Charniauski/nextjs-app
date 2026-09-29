import { CurrentUser } from '@/common/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard.js';
import type { TAuth } from '@/modules/auth/types/auth.types.js';
import { RequirePermission } from '@/modules/rbac/decorators/require-permission.js';
import { PermissionGuard } from '@/modules/rbac/guards/permissions.guard.js';
import { ConfirmEmailChangeDto } from '@/modules/users/dto/confirm-email-change.dto.js';
import { UpdateEmailDto } from '@/modules/users/dto/update-email.dto.js';
import { UpdatePasswordDto } from '@/modules/users/dto/update-password.dto.js';
import { UpdateProfileDto } from '@/modules/users/dto/update-profile.dto.js';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UserService } from './user.service.js';

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
  async getProfile(@CurrentUser() user: TAuth) {
    return await this.userService.findOne(user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me')
  async updateName(@Body() dto: UpdateProfileDto, @CurrentUser() user: TAuth) {
    return this.userService.updateName(dto, user);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me/password')
  async updatePassword(
    @Body() dto: UpdatePasswordDto,
    @CurrentUser() user: TAuth,
  ) {
    return this.userService.updatePassword(dto, user);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me/email')
  async updateEmail(@Body() dto: UpdateEmailDto, @CurrentUser() user: TAuth) {
    return this.userService.updateEmail(dto, user);
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('me/email/confirm')
  async confirmEmail(
    @Body() dto: ConfirmEmailChangeDto,
    @CurrentUser() user: TAuth,
  ) {
    return this.userService.confirmUpdateEmail(dto.code, user.userId);
  }
}
