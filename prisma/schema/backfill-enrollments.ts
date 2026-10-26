// prisma/schema/backfill-enrollments.ts
// Run once: pnpm db:backfill
import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, EnrollmentStatus } from "@prisma/client";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter });

async function main() {
  const students = await prisma.student.findMany({
    where: { isDeleted: false },
    include: { group: true },
  });

  console.log(`Backfilling ${students.length} students...`);

  for (const student of students) {
    const semesterId = student.currentSemesterId ?? student.group.currentSemesterId;

    const existing = await prisma.studentEnrollment.findFirst({
      where: { studentId: student.id, semesterId },
    });
    if (existing) continue;

    await prisma.$transaction([
      prisma.studentEnrollment.create({
        data: {
          studentId: student.id,
          semesterId,
          groupId: student.groupId,
          attemptNumber: student.currentAttempt || 1,
          status: EnrollmentStatus.ONGOING,
        },
      }),
      prisma.student.update({
        where: { id: student.id },
        data: { currentSemesterId: semesterId },
      }),
    ]);
  }

  console.log("Backfill complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());