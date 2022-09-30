/*
  Warnings:

  - You are about to drop the column `big_picture_url` on the `professors` table. All the data in the column will be lost.
  - You are about to drop the column `emails` on the `professors` table. All the data in the column will be lost.
  - You are about to drop the column `google_scholar_id` on the `professors` table. All the data in the column will be lost.
  - You are about to drop the column `link` on the `professors` table. All the data in the column will be lost.
  - You are about to drop the column `personal_site` on the `professors` table. All the data in the column will be lost.
  - You are about to drop the column `pic` on the `professors` table. All the data in the column will be lost.
  - You are about to drop the column `street_address` on the `professors` table. All the data in the column will be lost.
  - You are about to drop the column `url` on the `professors` table. All the data in the column will be lost.
  - Made the column `first_name` on table `professors` required. This step will fail if there are existing NULL values in that column.
  - Made the column `last_name` on table `professors` required. This step will fail if there are existing NULL values in that column.
  - Made the column `name` on table `professors` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "professors" DROP COLUMN "big_picture_url",
DROP COLUMN "emails",
DROP COLUMN "google_scholar_id",
DROP COLUMN "link",
DROP COLUMN "personal_site",
DROP COLUMN "pic",
DROP COLUMN "street_address",
DROP COLUMN "url",
ALTER COLUMN "first_name" SET NOT NULL,
ALTER COLUMN "last_name" SET NOT NULL,
ALTER COLUMN "name" SET NOT NULL;
