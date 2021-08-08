-- CreateTable
CREATE TABLE "followed_courses" (
    "course_hash" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL,

    PRIMARY KEY ("user_id","course_hash")
);

-- AddForeignKey
ALTER TABLE "followed_courses" ADD FOREIGN KEY ("course_hash") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "followed_courses" ADD FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
