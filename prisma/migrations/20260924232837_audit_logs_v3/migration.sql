-- AlterTable
ALTER TABLE "audit_logs" ALTER COLUMN "entityId" DROP NOT NULL,
ALTER COLUMN "metadata" DROP NOT NULL;
