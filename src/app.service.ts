import { Injectable } from '@nestjs/common';
import { PrismaService } from "./prisma/prisma.service.js";

@Injectable()
export class AppService {
  constructor(private prisma: PrismaService) {}

  async testDBConnections() {
    const users = this.prisma.user.findMany();

    return {
      massage: 'Connected to DB',
      users
    }
  }
}
