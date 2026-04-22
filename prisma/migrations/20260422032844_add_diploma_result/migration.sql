/*
  Warnings:

  - You are about to drop the `Result` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "DiplomaResultStatus" AS ENUM ('PASSED', 'REFERRED', 'FAILED', 'WITHHELD');

-- DropForeignKey
ALTER TABLE "Result" DROP CONSTRAINT "Result_groupId_fkey";

-- DropForeignKey
ALTER TABLE "Result" DROP CONSTRAINT "Result_semesterId_fkey";

-- DropForeignKey
ALTER TABLE "Result" DROP CONSTRAINT "Result_studentId_fkey";

-- DropTable
DROP TABLE "Result";

-- DropEnum
DROP TYPE "ResultStatus";

-- CreateTable
CREATE TABLE "DiplomaResult" (
    "id" SERIAL NOT NULL,
    "studentId" INTEGER,
    "semesterId" INTEGER,
    "groupId" INTEGER,
    "roll" TEXT NOT NULL,
    "instituteCode" TEXT NOT NULL,
    "instituteName" TEXT NOT NULL,
    "semesterName" TEXT NOT NULL,
    "examYear" INTEGER NOT NULL,
    "regulation" TEXT NOT NULL,
    "status" "DiplomaResultStatus" NOT NULL,
    "gpa1" DOUBLE PRECISION,
    "gpa2" DOUBLE PRECISION,
    "gpa3" DOUBLE PRECISION,
    "gpa4" DOUBLE PRECISION,
    "gpa5" DOUBLE PRECISION,
    "gpa6" DOUBLE PRECISION,
    "gpa7" DOUBLE PRECISION,
    "referredSubjects" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "failedSubjects" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiplomaResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DiplomaResult_studentId_idx" ON "DiplomaResult"("studentId");

-- CreateIndex
CREATE INDEX "DiplomaResult_semesterId_idx" ON "DiplomaResult"("semesterId");

-- CreateIndex
CREATE INDEX "DiplomaResult_groupId_idx" ON "DiplomaResult"("groupId");

-- CreateIndex
CREATE INDEX "DiplomaResult_roll_idx" ON "DiplomaResult"("roll");

-- CreateIndex
CREATE INDEX "DiplomaResult_instituteCode_idx" ON "DiplomaResult"("instituteCode");

-- CreateIndex
CREATE UNIQUE INDEX "DiplomaResult_roll_semesterName_examYear_regulation_key" ON "DiplomaResult"("roll", "semesterName", "examYear", "regulation");

-- AddForeignKey
ALTER TABLE "DiplomaResult" ADD CONSTRAINT "DiplomaResult_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiplomaResult" ADD CONSTRAINT "DiplomaResult_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "Semester"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiplomaResult" ADD CONSTRAINT "DiplomaResult_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;
