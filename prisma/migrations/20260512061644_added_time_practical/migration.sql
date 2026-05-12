-- AlterTable
ALTER TABLE "Practical" ADD COLUMN     "givenDate" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "submissionDeadline" TIMESTAMP(3);
