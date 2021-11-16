-- AddForeignKey
ALTER TABLE "followed_sections" ADD FOREIGN KEY ("section_hash") REFERENCES "sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
