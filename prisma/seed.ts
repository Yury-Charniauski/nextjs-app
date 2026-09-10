import { PrismaClient } from "@/generated/prisma/client.js";
import 'dotenv/config';

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.systemSetting.findFirst();

  if (!existing) {
    await prisma.systemSetting.create({
      data: {
        requireEmailConfirmationRegistration: true,
        requireEmailConfirmationReset: true,
        requireEmailConfirmationLogin: false,
      },
    });
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
