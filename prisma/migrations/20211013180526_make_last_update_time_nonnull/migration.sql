/*
  Warnings:

  - Made the column `last_update_time` on table `courses` required. This step will fail if there are existing NULL values in that column.
  - Made the column `last_update_time` on table `sections` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "courses" ALTER COLUMN "last_update_time" SET NOT NULL,
ALTER COLUMN "last_update_time" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "sections" ALTER COLUMN "last_update_time" SET NOT NULL,
ALTER COLUMN "last_update_time" SET DEFAULT CURRENT_TIMESTAMP;
