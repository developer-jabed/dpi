/*
  Warnings:

  - Made the column `code` on table `Department` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Department" ALTER COLUMN "code" SET NOT NULL;
