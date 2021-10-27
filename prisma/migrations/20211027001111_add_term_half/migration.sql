-- DropForeignKey
ALTER TABLE "followed_courses" DROP CONSTRAINT "followed_courses_course_hash_fkey";

-- DropForeignKey
ALTER TABLE "followed_courses" DROP CONSTRAINT "followed_courses_user_id_fkey";

-- DropForeignKey
ALTER TABLE "followed_sections" DROP CONSTRAINT "followed_sections_section_hash_fkey";

-- DropForeignKey
ALTER TABLE "followed_sections" DROP CONSTRAINT "followed_sections_user_id_fkey";

-- AlterTable
ALTER TABLE "sections" ADD COLUMN     "term_half" TEXT;

-- AddForeignKey
ALTER TABLE "followed_courses" ADD CONSTRAINT "followed_courses_course_hash_fkey" FOREIGN KEY ("course_hash") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "followed_courses" ADD CONSTRAINT "followed_courses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "followed_sections" ADD CONSTRAINT "followed_sections_section_hash_fkey" FOREIGN KEY ("section_hash") REFERENCES "sections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "followed_sections" ADD CONSTRAINT "followed_sections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "uniqueCourseProps" RENAME TO "courses_class_id_term_id_subject_key";

-- RenameIndex
ALTER INDEX "users.phone_number_unique" RENAME TO "users_phone_number_key";
