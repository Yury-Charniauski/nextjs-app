import 'dotenv/config';

import { PrismaClient } from '@/generated/prisma/client.js';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const isSettingsExisting = await prisma.systemSetting.findFirst();

  if (!isSettingsExisting) {
    await prisma.systemSetting.create({
      data: {
        requireEmailConfirmationRegistration: true,
        requireEmailConfirmationReset: true,
        requireEmailConfirmationLogin: false,
      },
    });
  }

  const adminRole = await prisma.role.upsert({
    where: { name: 'admin' },
    update: {},
    create: { name: 'admin', description: 'Full access' },
  });

  await prisma.role.upsert({
    where: { name: 'user' },
    update: {},
    create: { name: 'user', description: 'Limit access' },
  });

  const usersPermission = await prisma.permission.upsert({
    where: { name: 'users' },
    update: {},
    create: { name: 'users', actions: ['create', 'read', 'update', 'delete'] },
  });

  await prisma.grant.upsert({
    where: {
      roleId_permissionId: {
        roleId: adminRole.id,
        permissionId: usersPermission.id,
      },
    },
    update: {},
    create: {
      roleId: adminRole.id,
      permissionId: usersPermission.id,
      actions: [],
    },
  });

  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD must be set');
  }

  const passwordHash = await bcrypt.hash(adminPassword || '', 10);

  const adminUser = await prisma.user.upsert({
    where: {
      email: adminEmail,
    },
    update: {},
    create: {
      email: adminEmail,
      password: passwordHash,
      status: 'ACTIVE',
    },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: adminUser.id,
        roleId: adminRole.id,
      },
    },
    update: {},
    create: {
      userId: adminUser.id,
      roleId: adminRole.id,
    },
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
