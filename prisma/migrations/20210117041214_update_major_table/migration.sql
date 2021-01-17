/*
  Warnings:

  - The migration will change the primary key for the `majors` table. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `catalog_year` on the `majors` table. All the data in the column will be lost.
  - You are about to drop the column `id` on the `majors` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `majors` table. All the data in the column will be lost.
  - You are about to drop the column `requirements` on the `majors` table. All the data in the column will be lost.
  - Added the required column `year_version` to the `majors` table without a default value. This is not possible if the table is not empty.
  - Added the required column `spec` to the `majors` table without a default value. This is not possible if the table is not empty.
  - Made the column `major_id` on table `majors` required. The migration will fail if there are existing NULL values in that column.
  - Made the column `plans_of_study` on table `majors` required. The migration will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "majors" DROP CONSTRAINT "majors_pkey",
DROP COLUMN "catalog_year",
DROP COLUMN "id",
DROP COLUMN "name",
DROP COLUMN "requirements",
ADD COLUMN     "year_version" TEXT NOT NULL,
ADD COLUMN     "spec" JSONB NOT NULL,
ALTER COLUMN "major_id" SET NOT NULL,
ALTER COLUMN "plans_of_study" SET NOT NULL,
ADD PRIMARY KEY ("year_version", "major_id");
