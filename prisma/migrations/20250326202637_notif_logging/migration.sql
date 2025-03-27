/*
  Warnings:

  - The primary key for the `followed_courses` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `followed_sections` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- AlterTable
ALTER TABLE "followed_courses" DROP CONSTRAINT "followed_courses_pkey",
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD CONSTRAINT "followed_courses_pkey" PRIMARY KEY ("user_id", "course_hash", "created_at");

-- AlterTable
ALTER TABLE "followed_sections" DROP CONSTRAINT "followed_sections_pkey",
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD CONSTRAINT "followed_sections_pkey" PRIMARY KEY ("user_id", "section_hash", "created_at");

-- CreateTable
CREATE TABLE "sent_notifs" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "courseHash" TEXT NOT NULL,
    "subscription_created_at" TIMESTAMP(3) NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updateId" TIMESTAMP(3) NOT NULL,
    "sent" BOOLEAN NOT NULL,

    CONSTRAINT "sent_notifs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "updates" (
    "updateId" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "diffs" JSONB NOT NULL,

    CONSTRAINT "updates_pkey" PRIMARY KEY ("updateId")
);

-- CreateIndex
CREATE UNIQUE INDEX "sent_notifs_userId_courseHash_subscription_created_at_key" ON "sent_notifs"("userId", "courseHash", "subscription_created_at");

-- CreateIndex
CREATE UNIQUE INDEX "updates_updateId_key" ON "updates"("updateId");

-- AddForeignKey
ALTER TABLE "sent_notifs" ADD CONSTRAINT "sent_notifs_updateId_fkey" FOREIGN KEY ("updateId") REFERENCES "updates"("updateId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sent_notifs" ADD CONSTRAINT "sent_notifs_followed_section_fkey" FOREIGN KEY ("userId", "courseHash", "subscription_created_at") REFERENCES "followed_sections"("user_id", "section_hash", "created_at") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sent_notifs" ADD CONSTRAINT "sent_notifs_followed_course_fkey" FOREIGN KEY ("userId", "courseHash", "subscription_created_at") REFERENCES "followed_courses"("user_id", "course_hash", "created_at") ON DELETE RESTRICT ON UPDATE CASCADE;
