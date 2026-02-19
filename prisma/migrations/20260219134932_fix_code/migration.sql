/*
  Warnings:

  - The `code` column on the `Department` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "Department" DROP COLUMN "code",
ADD COLUMN     "code" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Department_code_key" ON "Department"("code");
