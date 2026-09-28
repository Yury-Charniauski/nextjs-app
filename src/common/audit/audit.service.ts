import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '@/prisma/prisma.service.js';
import { Injectable, Logger } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';

@Injectable()
export class AuditService {
  private readonly logger: Logger = new Logger(AuditService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
  ) {}

  async log(
    entry: {
      action: 'create' | 'update' | 'delete';
      entity: 'role' | 'permission' | 'grant' | 'userRole';
      entityId?: string;
      metadata?: Prisma.InputJsonValue;
    },
    db: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    const actorId = this.cls.get<string>('actorId');

    await db.auditLog.create({
      data: {
        ...entry,
        actorId,
        metadata: {
          ...(typeof entry.metadata === 'object' &&
          entry.metadata !== null &&
          !Array.isArray(entry.metadata)
            ? entry.metadata
            : {}),
          method: this.cls.get<string>('method'),
          uri: this.cls.get<string>('uri'),
        },
      },
    });
    this.logger.log(`${entry.action} by ${actorId} (${entry.entityId ?? '-'})`);
  }
}
