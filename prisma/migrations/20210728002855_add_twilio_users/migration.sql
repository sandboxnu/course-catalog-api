-- CreateTable
CREATE TABLE "followed_sections" (
    "section_hash" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL,

    PRIMARY KEY ("user_id","section_hash")
);

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "phoneNumber" TEXT NOT NULL,

    PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "followed_sections" ADD FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
