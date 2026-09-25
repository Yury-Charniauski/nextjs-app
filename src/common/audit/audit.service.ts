import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '@/prisma/prisma.service.js';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class AuditService {
  private readonly logger: Logger = new Logger(AuditService.name);
  constructor(private readonly prisma: PrismaService) {}

  async log(
    entry: {
      actorId: string;
      action: string;
      entity: string;
      entityId?: string;
      metadata?: Prisma.InputJsonValue;
    },
    db: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    await db.auditLog.create({
      data: entry,
    });
    this.logger.log(
      `${entry.action} by ${entry.actorId} (${entry.entityId ?? '-'})`,
    );
  }
}
