import { Request } from 'express';

export type PermissionMeta = { permission: string; action: string };

export type TMatrix = Record<string, Record<string, '*' | string[]>>;

export type AuthRequest = Request & { user?: { userId: string } };
