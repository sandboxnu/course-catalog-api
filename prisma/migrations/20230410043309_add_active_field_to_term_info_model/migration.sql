/*
  Warnings:

  - Added the required column `active` to the `term_ids` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "term_ids" ADD COLUMN     "active" BOOLEAN NOT NULL;
