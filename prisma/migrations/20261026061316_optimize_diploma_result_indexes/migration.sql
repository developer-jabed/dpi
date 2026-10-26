-- DropIndex
DROP INDEX "DiplomaResult_instituteCode_idx";

-- DropIndex
DROP INDEX "DiplomaResult_roll_idx";

-- CreateIndex
CREATE INDEX "DiplomaResult_roll_isDeleted_idx" ON "DiplomaResult"("roll", "isDeleted");

-- CreateIndex
CREATE INDEX "DiplomaResult_roll_examYear_idx" ON "DiplomaResult"("roll", "examYear" DESC);

-- CreateIndex
CREATE INDEX "DiplomaResult_instituteCode_isDeleted_idx" ON "DiplomaResult"("instituteCode", "isDeleted");

-- CreateIndex
CREATE INDEX "DiplomaResult_status_idx" ON "DiplomaResult"("status");

-- CreateIndex
CREATE INDEX "DiplomaResult_examYear_idx" ON "DiplomaResult"("examYear");

-- CreateIndex
CREATE INDEX "DiplomaResultSubject_diplomaResultId_type_idx" ON "DiplomaResultSubject"("diplomaResultId", "type");
