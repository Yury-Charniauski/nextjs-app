import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { UserStatus } from '@/generated/prisma/enums.js';
import { PrismaService } from '@/prisma/prisma.service.js';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: { email: string; password: string; status: UserStatus }) {
    return this.prisma.$transaction(async (tx) => {
      const defaultRole = await tx.role.findUnique({ where: { name: 'user' } });

      if (!defaultRole) {
        throw new InternalServerErrorException(
          'Default role is not configured',
        );
      }

      const created = await tx.user.create({
        data,
        select: {
          id: true,
          email: true,
          status: true,
        },
      });

      await tx.userRole.create({
        data: { userId: created.id, roleId: defaultRole.id },
      });

      return created;
    });
  }

  async findAll() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
      },
    });
  }

  async findOne(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, status: true },
    });
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async updateStatus(id: string, status: UserStatus) {
    return this.prisma.user.update({
      where: { id },
      data: { status },
      select: { id: true, email: true, status: true },
    });
  }
}
