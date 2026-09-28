import { REDIS_CLIENT } from '@/common/redis/redis.module.js';
import { RbacService } from '@/modules/rbac/services/rbac.service.js';
import { PrismaService } from '@/prisma/prisma.service.js';
import { Test, TestingModule } from '@nestjs/testing';
import { vi } from 'vitest';

describe('RbacService', () => {
  let service: RbacService;
  const prisma = {
    userRole: { findMany: vi.fn() },
  };

  const redis = {
    get: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RbacService,
        { provide: PrismaService, useValue: prisma },
        { provide: REDIS_CLIENT, useValue: redis },
      ],
    }).compile();

    service = module.get(RbacService);
  });

  it('allows an explicit action', async () => {
    prisma.userRole.findMany.mockResolvedValue([{ role: { name: 'editor' } }]);
    redis.get.mockResolvedValue(
      JSON.stringify({ editor: { users: ['read'] } }),
    );

    await expect(service.can('user-1', 'users', 'read')).resolves.toBe(true);
  });

  it('full access', async () => {
    prisma.userRole.findMany.mockResolvedValue([{ role: { name: 'admin' } }]);
    redis.get.mockResolvedValue(JSON.stringify({ admin: { users: '*' } }));

    await expect(service.can('user-1', 'users', 'read')).resolves.toBe(true);
  });

  it('The action is not on the list', async () => {
    prisma.userRole.findMany.mockResolvedValue([{ role: { name: 'editor' } }]);
    redis.get.mockResolvedValue(
      JSON.stringify({ editor: { users: ['updated'] } }),
    );

    await expect(service.can('user-1', 'users', 'read')).resolves.toBe(false);
  });
});
