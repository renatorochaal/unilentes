-- CreateTable
CREATE TABLE `category_treatments` (
    `id` VARCHAR(191) NOT NULL,
    `categoryId` VARCHAR(191) NOT NULL,
    `treatmentId` VARCHAR(191) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `category_treatments_treatmentId_idx`(`treatmentId`),
    UNIQUE INDEX `category_treatments_categoryId_treatmentId_key`(`categoryId`, `treatmentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `category_treatments` ADD CONSTRAINT `category_treatments_categoryId_fkey`
  FOREIGN KEY (`categoryId`) REFERENCES `categories`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `category_treatments` ADD CONSTRAINT `category_treatments_treatmentId_fkey`
  FOREIGN KEY (`treatmentId`) REFERENCES `treatments`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;
