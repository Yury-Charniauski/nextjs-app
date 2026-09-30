import {
  AdminAuditEntry,
  AuditWriteEntry,
  AuthAuditEntry,
} from '@/common/audit/types/audit.types.js';
import { PrismaService } from '@/prisma/prisma.service.js';
import { Injectable, Logger } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { Prisma } from '../../generated/prisma/client.js';

@Injectable()
export class AuditService {
  private readonly logger: Logger = new Logger(AuditService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
  ) {}

  private async write(
    { action, entity, entityId, actorId, metadata }: AuditWriteEntry,
    db: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    await db.auditLog.create({
      data: {
        action: action,
        entity: entity,
        entityId: entityId,
        actorId: actorId ?? null,
        metadata: {
          ...(typeof metadata === 'object' &&
          metadata !== null &&
          !Array.isArray(metadata)
            ? metadata
            : {}),
          method: this.cls.get<string>('method'),
          uri: this.cls.get<string>('uri'),
        },
      },
    });
    this.logger.log(`${action} by ${actorId} (${entityId ?? '-'})`);
  }

  async log(
    entry: AdminAuditEntry,
    db: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    const actorId = this.cls.get<string>('actorId') ?? null;

    await this.write({ ...entry, actorId }, db);
  }

  async authLog(
    entry: AuthAuditEntry,
    db: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    await this.write({ ...entry, entity: 'auth' }, db);
  }
}
