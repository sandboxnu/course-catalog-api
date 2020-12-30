-- CreateTable
CREATE TABLE "courses" (
    "class_attributes" TEXT[],
    "class_id" TEXT,
    "coreqs" JSONB,
    "description" TEXT,
    "fee_amount" INTEGER,
    "fee_description" TEXT,
    "host" TEXT,
    "id" TEXT NOT NULL,
    "last_update_time" TIMESTAMP(3),
    "max_credits" INTEGER,
    "min_credits" INTEGER,
    "name" TEXT,
    "nupath" TEXT[],
    "opt_prereqs_for" JSONB,
    "prereqs" JSONB,
    "prereqs_for" JSONB,
    "pretty_url" TEXT,
    "subject" TEXT,
    "term_id" TEXT,
    "url" TEXT,

    PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "followed_courses" (
    "course_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,

    PRIMARY KEY ("user_id","course_id")
);

-- CreateTable
CREATE TABLE "followed_sections" (
    "section_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,

    PRIMARY KEY ("user_id","section_id")
);

-- CreateTable
CREATE TABLE "majors" (
    "catalog_year" TEXT,
"id" SERIAL,
    "major_id" TEXT,
    "name" TEXT,
    "plans_of_study" JSONB,
    "requirements" JSONB,

    PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "professors" (
    "big_picture_url" TEXT,
    "email" TEXT,
    "emails" TEXT[],
    "first_name" TEXT,
    "google_scholar_id" TEXT,
    "id" TEXT NOT NULL,
    "last_name" TEXT,
    "link" TEXT,
    "name" TEXT,
    "office_room" TEXT,
    "personal_site" TEXT,
    "phone" TEXT,
    "pic" JSONB,
    "primary_department" TEXT,
    "primary_role" TEXT,
    "street_address" TEXT,
    "url" TEXT,

    PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sections" (
    "class_hash" TEXT,
    "class_type" TEXT,
    "crn" TEXT,
    "honors" BOOLEAN,
    "id" TEXT NOT NULL,
    "info" TEXT,
    "meetings" JSONB,
    "campus" TEXT,
    "profs" TEXT[],
    "seats_capacity" INTEGER,
    "seats_remaining" INTEGER,
    "url" TEXT,
    "wait_capacity" INTEGER,
    "wait_remaining" INTEGER,

    PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "facebook_page_id" TEXT,
    "first_name" TEXT,
    "id" TEXT NOT NULL,
    "last_name" TEXT,
    "login_keys" TEXT[],

    PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subjects" (
    "abbreviation" TEXT NOT NULL,
    "description" TEXT NOT NULL,

    PRIMARY KEY ("abbreviation")
);

-- CreateIndex
CREATE UNIQUE INDEX "uniqueCourseProps" ON "courses"("class_id", "term_id", "subject");

-- AddForeignKey
ALTER TABLE "followed_courses" ADD FOREIGN KEY("course_id")REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "followed_courses" ADD FOREIGN KEY("user_id")REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "followed_sections" ADD FOREIGN KEY("section_id")REFERENCES "sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "followed_sections" ADD FOREIGN KEY("user_id")REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sections" ADD FOREIGN KEY("class_hash")REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
