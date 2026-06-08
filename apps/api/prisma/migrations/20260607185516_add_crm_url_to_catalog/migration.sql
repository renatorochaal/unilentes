-- AlterTable
ALTER TABLE "catalogs" ADD COLUMN     "crmUrl" TEXT,
ADD COLUMN     "sections" JSONB,
ADD COLUMN     "visibleColumns" JSONB;
