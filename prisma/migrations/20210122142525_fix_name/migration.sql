/*
  Warnings:

  - You are about to drop the column `templatesDisplayFolder` on the `Settings` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Settings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "packageManager" TEXT NOT NULL DEFAULT 'yarn',
    "editor" TEXT NOT NULL DEFAULT 'code',
    "displayFolders" BOOLEAN NOT NULL DEFAULT false,
    "userId" INTEGER NOT NULL,
    FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Settings" ("id", "packageManager", "editor", "userId") SELECT "id", "packageManager", "editor", "userId" FROM "Settings";
DROP TABLE "Settings";
ALTER TABLE "new_Settings" RENAME TO "Settings";
CREATE UNIQUE INDEX "Settings_userId_unique" ON "Settings"("userId");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
