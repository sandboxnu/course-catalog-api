-- DropForeignKey
ALTER TABLE "sections" DROP CONSTRAINT "sections_class_hash_fkey";

-- AddForeignKey
ALTER TABLE "sections" ADD FOREIGN KEY ("class_hash") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
