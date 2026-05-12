-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('SEMINAR', 'WORKSHOP', 'SKILL_COMPETITION', 'CULTURAL', 'TOURNAMENT', 'DEBATE', 'FAREWELL', 'FRESHERS_RECEPTION', 'OTHER');

-- CreateTable
CREATE TABLE "Event" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "photoUrl" TEXT,
    "eventLinks" TEXT[],
    "driveLink" TEXT,
    "eventType" "EventType" NOT NULL DEFAULT 'OTHER',
    "location" TEXT,
    "eventDate" TIMESTAMP(3),
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "createdById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;
