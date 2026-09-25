import { AuditService } from '@/common/audit/audit.service.js';
import { Module } from '@nestjs/common';

@Module({
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
