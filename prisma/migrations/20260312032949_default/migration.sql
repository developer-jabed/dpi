/*
  Warnings:

  - A unique constraint covering the columns `[studentId]` on the table `Cr` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `studentId` to the `Cr` table without a default value. This is not possible if the table is not empty.
  - Added the required column `studentId` to the `DiplomaResult` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Cr" DROP CONSTRAINT "Cr_userId_fkey";

-- AlterTable
ALTER TABLE "Cr" ADD COLUMN     "studentId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "DiplomaResult" ADD COLUMN     "studentId" INTEGER NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Cr_studentId_key" ON "Cr"("studentId");

-- AddForeignKey
ALTER TABLE "DiplomaResult" ADD CONSTRAINT "DiplomaResult_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cr" ADD CONSTRAINT "Cr_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cr" ADD CONSTRAINT "Cr_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
