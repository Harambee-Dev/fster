-- CreateTable
CREATE TABLE "Project" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "url" TEXT NOT NULL,
    "name" TEXT,
    "path" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Project.url_unique" ON "Project"("url");
