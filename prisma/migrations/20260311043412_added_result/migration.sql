-- CreateTable
CREATE TABLE "DiplomaResult" (
    "id" SERIAL NOT NULL,
    "roll" TEXT NOT NULL,
    "instituteCode" TEXT NOT NULL,
    "instituteName" TEXT NOT NULL,
    "semester" TEXT NOT NULL,
    "regulation" TEXT NOT NULL,
    "examYear" INTEGER NOT NULL,
    "publishedDate" TIMESTAMP(3),
    "gpa1" DOUBLE PRECISION,
    "gpa2" DOUBLE PRECISION,
    "gpa3" DOUBLE PRECISION,
    "overallGpa" DOUBLE PRECISION,
    "status" TEXT NOT NULL,
    "failedSubjects" JSONB,
    "referredSubjects" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiplomaResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DiplomaResult_roll_key" ON "DiplomaResult"("roll");
