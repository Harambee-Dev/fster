/*
  Warnings:

  - The migration will change the primary key for the `Project` table. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `Project` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Project" (
    "url" TEXT NOT NULL,
    "name" TEXT,
    "path" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,

    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Project" ("url", "name", "path", "userId") SELECT "url", "name", "path", "userId" FROM "Project";
DROP TABLE "Project";
ALTER TABLE "new_Project" RENAME TO "Project";
CREATE UNIQUE INDEX "Project.url_unique" ON "Project"("url");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
