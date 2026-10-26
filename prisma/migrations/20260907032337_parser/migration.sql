-- CreateEnum
CREATE TYPE "SubjectResultType" AS ENUM ('REFERRED', 'FAILED');

-- CreateTable
CREATE TABLE "DiplomaResultSubject" (
    "id" SERIAL NOT NULL,
    "diplomaResultId" INTEGER NOT NULL,
    "subjectId" INTEGER,
    "subjectCode" TEXT NOT NULL,
    "type" "SubjectResultType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiplomaResultSubject_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DiplomaResultSubject_subjectId_idx" ON "DiplomaResultSubject"("subjectId");

-- CreateIndex
CREATE INDEX "DiplomaResultSubject_diplomaResultId_idx" ON "DiplomaResultSubject"("diplomaResultId");

-- CreateIndex
CREATE INDEX "DiplomaResultSubject_subjectCode_idx" ON "DiplomaResultSubject"("subjectCode");

-- CreateIndex
CREATE INDEX "DiplomaResultSubject_type_idx" ON "DiplomaResultSubject"("type");

-- AddForeignKey
ALTER TABLE "DiplomaResultSubject" ADD CONSTRAINT "DiplomaResultSubject_diplomaResultId_fkey" FOREIGN KEY ("diplomaResultId") REFERENCES "DiplomaResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiplomaResultSubject" ADD CONSTRAINT "DiplomaResultSubject_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
