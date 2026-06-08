-- AlterTable
ALTER TABLE `catalogs`
  ADD COLUMN `crmUrl` TEXT NULL,
  ADD COLUMN `visibleColumns` JSON NULL,
  ADD COLUMN `sections` JSON NULL;
