import { SetMetadata } from '@nestjs/common';

export const PERMISSION_KEY = 'permission';

export const RequirePermission = (permission: string, action: string) =>
  SetMetadata(PERMISSION_KEY, { permission, action });
