-- CreateTable
CREATE TABLE "ClassRoutine" (
    "id" SERIAL NOT NULL,
    "groupId" INTEGER NOT NULL,
    "subjectGroupId" INTEGER NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "period" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "room" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassRoutine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClassRoutine_groupId_dayOfWeek_period_key" ON "ClassRoutine"("groupId", "dayOfWeek", "period");

-- AddForeignKey
ALTER TABLE "ClassRoutine" ADD CONSTRAINT "ClassRoutine_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassRoutine" ADD CONSTRAINT "ClassRoutine_subjectGroupId_fkey" FOREIGN KEY ("subjectGroupId") REFERENCES "SubjectGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
