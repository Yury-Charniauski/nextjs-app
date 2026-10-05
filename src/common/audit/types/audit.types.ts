import { Prisma } from '@/generated/prisma/client.js';

export type CrudAction = 'create' | 'update' | 'delete';

export type AdminLogEntity =
  'role' | 'permission' | 'grant' | 'userRole' | 'user';

export type AuthAuditAction =
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILED'
  | 'LOGIN_2FA_DISPATCHED'
  | 'LOGIN_2FA_FAILED'
  | 'LOGIN_LOCKOUT'
  | 'AUTH_DENIED'

export type AdminAuditEntry = {
  action: CrudAction;
  entity: AdminLogEntity;
  entityId?: string;
  metadata?: Prisma.InputJsonValue;
};

export type AuthAuditEntry = {
  action: AuthAuditAction;
  entityId?: string;
  actorId: string | null;
  metadata?: Prisma.InputJsonValue;
};

export type AuditWriteEntry = {
  action: string;
  entity: AdminLogEntity | 'auth';
  entityId?: string;
  actorId: string | null;
  metadata?: Prisma.InputJsonValue;
};
