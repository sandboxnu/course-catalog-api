/*
  Warnings:

  - You are about to drop the column `maxEndDate` on the `term_ids` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "term_ids" DROP COLUMN "maxEndDate",
ADD COLUMN     "isCurrentTerm" BOOLEAN NOT NULL DEFAULT true;
