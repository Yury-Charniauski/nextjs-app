import { UserStatus } from '@/generated/prisma/enums.js';
import { RegisterDto } from '@/modules/auth/dto/register.dto.js';
import { UserService } from '@/modules/users/user.service.js';
import { ConflictException, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(private readonly userService: UserService) {}

  async register(dto: RegisterDto): Promise<{
    userId: string;
    email: string;
    status: UserStatus;
    requireConfirmation: boolean;
  }> {
    const existedEmail = await this.userService.findByEmail(dto.email);
    if (existedEmail) {
      throw new ConflictException('Email already registered.');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.userService.create({
      email: dto.email,
      password: passwordHash,
      status: UserStatus.ACTIVE,
    });

    return {
      userId: user.id,
      email: user.email,
      status: user.status,
      requireConfirmation: false,
    };
  }
}
