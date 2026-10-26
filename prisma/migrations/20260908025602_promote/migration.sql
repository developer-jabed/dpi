-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('ONGOING', 'PASSED', 'RETAKING', 'DROPPED');

-- AlterTable
ALTER TABLE "AttendanceRecord" ADD COLUMN     "enrollmentId" INTEGER;

-- AlterTable
ALTER TABLE "AttendanceSession" ADD COLUMN     "enrollmentId" INTEGER;

-- AlterTable
ALTER TABLE "PracticalSubmission" ADD COLUMN     "enrollmentId" INTEGER;

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "currentAttempt" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "currentSemesterId" INTEGER;

-- CreateTable
CREATE TABLE "StudentEnrollment" (
    "id" SERIAL NOT NULL,
    "studentId" INTEGER NOT NULL,
    "semesterId" INTEGER NOT NULL,
    "groupId" INTEGER NOT NULL,
    "attemptNumber" INTEGER NOT NULL DEFAULT 1,
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'ONGOING',
    "resultId" INTEGER,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StudentEnrollment_resultId_key" ON "StudentEnrollment"("resultId");

-- CreateIndex
CREATE INDEX "StudentEnrollment_studentId_idx" ON "StudentEnrollment"("studentId");

-- CreateIndex
CREATE INDEX "StudentEnrollment_semesterId_idx" ON "StudentEnrollment"("semesterId");

-- CreateIndex
CREATE INDEX "StudentEnrollment_groupId_idx" ON "StudentEnrollment"("groupId");

-- CreateIndex
CREATE INDEX "StudentEnrollment_status_idx" ON "StudentEnrollment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "StudentEnrollment_studentId_semesterId_attemptNumber_key" ON "StudentEnrollment"("studentId", "semesterId", "attemptNumber");

-- CreateIndex
CREATE INDEX "AttendanceRecord_enrollmentId_idx" ON "AttendanceRecord"("enrollmentId");

-- CreateIndex
CREATE INDEX "AttendanceSession_enrollmentId_idx" ON "AttendanceSession"("enrollmentId");

-- CreateIndex
CREATE INDEX "PracticalSubmission_enrollmentId_idx" ON "PracticalSubmission"("enrollmentId");

-- AddForeignKey
ALTER TABLE "StudentEnrollment" ADD CONSTRAINT "StudentEnrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentEnrollment" ADD CONSTRAINT "StudentEnrollment_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "Semester"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentEnrollment" ADD CONSTRAINT "StudentEnrollment_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentEnrollment" ADD CONSTRAINT "StudentEnrollment_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "DiplomaResult"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_currentSemesterId_fkey" FOREIGN KEY ("currentSemesterId") REFERENCES "Semester"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticalSubmission" ADD CONSTRAINT "PracticalSubmission_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "StudentEnrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceSession" ADD CONSTRAINT "AttendanceSession_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "StudentEnrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "StudentEnrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
