-- CreateIndex
CREATE INDEX "User_email_isDeleted_idx" ON "User"("email", "isDeleted");
