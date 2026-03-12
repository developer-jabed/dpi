/*
  Warnings:

  - Made the column `isDeleted` on table `Teacher` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Teacher" ALTER COLUMN "isDeleted" SET NOT NULL;
