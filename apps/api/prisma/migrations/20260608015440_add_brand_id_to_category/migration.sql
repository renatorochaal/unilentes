-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "brandId" TEXT;

-- CreateIndex
CREATE INDEX "categories_brandId_idx" ON "categories"("brandId");

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;
