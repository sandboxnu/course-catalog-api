/*
  Warnings:

  - You are about to drop the `followed_courses` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `followed_sections` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `users` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "followed_courses" DROP CONSTRAINT "followed_courses_course_id_fkey";

-- DropForeignKey
ALTER TABLE "followed_courses" DROP CONSTRAINT "followed_courses_user_id_fkey";

-- DropForeignKey
ALTER TABLE "followed_sections" DROP CONSTRAINT "followed_sections_section_id_fkey";

-- DropForeignKey
ALTER TABLE "followed_sections" DROP CONSTRAINT "followed_sections_user_id_fkey";

-- DropTable
DROP TABLE "followed_courses";

-- DropTable
DROP TABLE "followed_sections";

-- DropTable
DROP TABLE "users";
