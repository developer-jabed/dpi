-- CreateEnum
CREATE TYPE "PracticalType" AS ENUM ('PRACTICAL', 'JOB');

-- CreateTable
CREATE TABLE "Practical" (
    "id" SERIAL NOT NULL,
    "subjectGroupId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "totalMarks" INTEGER NOT NULL,
    "type" "PracticalType" NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Practical_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PracticalSubmission" (
    "id" SERIAL NOT NULL,
    "practicalId" INTEGER NOT NULL,
    "studentId" INTEGER NOT NULL,
    "obtainedMarks" INTEGER,
    "submitted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PracticalSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PracticalSubmission_practicalId_studentId_key" ON "PracticalSubmission"("practicalId", "studentId");

-- AddForeignKey
ALTER TABLE "Practical" ADD CONSTRAINT "Practical_subjectGroupId_fkey" FOREIGN KEY ("subjectGroupId") REFERENCES "SubjectGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticalSubmission" ADD CONSTRAINT "PracticalSubmission_practicalId_fkey" FOREIGN KEY ("practicalId") REFERENCES "Practical"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticalSubmission" ADD CONSTRAINT "PracticalSubmission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
