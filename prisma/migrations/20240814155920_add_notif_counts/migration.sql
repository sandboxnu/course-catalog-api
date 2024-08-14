-- AlterTable
ALTER TABLE "followed_courses" ADD COLUMN     "notif_count" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "followed_sections" ADD COLUMN     "notif_count" INTEGER NOT NULL DEFAULT 0;
