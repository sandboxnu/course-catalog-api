-- CreateTable
CREATE TABLE "term_ids" (
    "term_id" TEXT NOT NULL,
    "sub_college" TEXT NOT NULL,
    "text" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "term_ids.term_id_unique" ON "term_ids"("term_id");

