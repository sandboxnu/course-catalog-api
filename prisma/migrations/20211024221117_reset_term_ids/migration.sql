/*
  Warnings:

  - Added the required column `sub_college` to the `term_ids` table without a default value. This is not possible if the table is not empty.
  - Added the required column `text` to the `term_ids` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "term_ids" ADD COLUMN     "sub_college" TEXT NOT NULL,
ADD COLUMN     "text" TEXT NOT NULL;
