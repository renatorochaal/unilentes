-- AlterTable
ALTER TABLE `categories` ADD COLUMN `brandId` VARCHAR(191) NULL;

-- DropIndex
DROP INDEX `categories_name_key` ON `categories`;

-- CreateIndex
CREATE INDEX `categories_brandId_idx` ON `categories`(`brandId`);

-- CreateIndex
CREATE UNIQUE INDEX `categories_name_brandId_key` ON `categories`(`name`, `brandId`);

-- AddForeignKey
ALTER TABLE `categories` ADD CONSTRAINT `categories_brandId_fkey`
  FOREIGN KEY (`brandId`) REFERENCES `brands`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
