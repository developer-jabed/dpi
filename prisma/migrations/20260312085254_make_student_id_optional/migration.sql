-- DropForeignKey
ALTER TABLE "DiplomaResult" DROP CONSTRAINT "DiplomaResult_studentId_fkey";

-- AlterTable
ALTER TABLE "DiplomaResult" ALTER COLUMN "studentId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "DiplomaResult" ADD CONSTRAINT "DiplomaResult_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;
