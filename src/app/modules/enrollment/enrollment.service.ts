import httpStatus from "http-status";
import { prisma } from "../../shared/prisma";
import ApiError from "../../errors/api.error";
import { EnrollmentStatus, DiplomaResultStatus } from "@prisma/client";
import { FAIL_THRESHOLD } from "./enrollment.constant";

const promoteBatch = async (payload: {
  fromGroupId: number;
  fromSemesterId: number;
  toGroupId: number;
  toSemesterId: number;
}) => {
  const { fromGroupId, fromSemesterId, toGroupId, toSemesterId } = payload;

  if (fromGroupId === toGroupId && fromSemesterId === toSemesterId) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "From and To cannot be exactly the same group + semester"
    );
  }

  // Validate both groups exist
  const [fromGroup, toGroup] = await Promise.all([
    prisma.group.findUnique({ where: { id: fromGroupId } }),
    prisma.group.findUnique({ where: { id: toGroupId } }),
  ]);

  if (!fromGroup) throw new ApiError(httpStatus.NOT_FOUND, "From group not found");
  if (!toGroup) throw new ApiError(httpStatus.NOT_FOUND, "To group not found");

  // Validate both semesters exist
  const [fromSemester, toSemester] = await Promise.all([
    prisma.semester.findUnique({ where: { id: fromSemesterId } }),
    prisma.semester.findUnique({ where: { id: toSemesterId } }),
  ]);

  if (!fromSemester) throw new ApiError(httpStatus.NOT_FOUND, "From semester not found");
  if (!toSemester) throw new ApiError(httpStatus.NOT_FOUND, "To semester not found");

  // Students currently in the FROM group + FROM semester
  const students = await prisma.student.findMany({
    where: {
      groupId: fromGroupId,
      isDeleted: false,
      currentSemesterId: fromSemesterId,
    },
    select: { id: true },
  });

  if (students.length === 0) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "No eligible students found in the selected From group/semester"
    );
  }

  const studentIds = students.map((s) => s.id);

  // Prefetch enrollments
  const [fromEnrollments, existingTargetEnrollments] = await Promise.all([
    prisma.studentEnrollment.findMany({
      where: {
        studentId: { in: studentIds },
        semesterId: fromSemesterId,
        isDeleted: false,
      },
      orderBy: { attemptNumber: "desc" },
    }),
    prisma.studentEnrollment.findMany({
      where: {
        studentId: { in: studentIds },
        semesterId: toSemesterId,
        attemptNumber: 1,
      },
      select: { studentId: true },
    }),
  ]);

  const latestFromEnrollment = new Map<number, (typeof fromEnrollments)[0]>();
  for (const enr of fromEnrollments) {
    if (!latestFromEnrollment.has(enr.studentId)) {
      latestFromEnrollment.set(enr.studentId, enr);
    }
  }

  const alreadyHasTarget = new Set(existingTargetEnrollments.map((e) => e.studentId));

  const toSkip: { studentId: number; reason: string }[] = [];
  const toCloseEnrollmentIds: number[] = [];
  const toCreate: {
    studentId: number;
    semesterId: number;
    groupId: number;
    attemptNumber: number;
    status: "ONGOING";
  }[] = [];
  const toPromoteStudentIds: number[] = [];

  for (const student of students) {
    const active = latestFromEnrollment.get(student.id);

    if (active?.status === EnrollmentStatus.RETAKING) {
      toSkip.push({ studentId: student.id, reason: "Already flagged RETAKING" });
      continue;
    }

    if (active && active.status !== EnrollmentStatus.DROPPED) {
      toCloseEnrollmentIds.push(active.id);
    }

    if (!alreadyHasTarget.has(student.id)) {
      toCreate.push({
        studentId: student.id,
        semesterId: toSemesterId,
        groupId: toGroupId,               // ← move to the TARGET group
        attemptNumber: 1,
        status: "ONGOING",
      });
    }

    toPromoteStudentIds.push(student.id);
  }

  const result = await prisma.$transaction(
    async (tx) => {
      if (toCloseEnrollmentIds.length > 0) {
        await tx.studentEnrollment.updateMany({
          where: { id: { in: toCloseEnrollmentIds } },
          data: { endedAt: new Date() },
        });
      }

      if (toCreate.length > 0) {
        await tx.studentEnrollment.createMany({
          data: toCreate,
          skipDuplicates: true,
        });
      }

      if (toPromoteStudentIds.length > 0) {
        await tx.student.updateMany({
          where: { id: { in: toPromoteStudentIds } },
          data: {
            currentSemesterId: toSemesterId,
            groupId: toGroupId,             // ← also update student’s home group
          },
        });
      }

      // Update the target group’s current semester pointer
      await tx.group.update({
        where: { id: toGroupId },
        data: { currentSemesterId: toSemesterId },
      });

      // Optionally also advance the source group if it is different
      // (only if you want the old group to stay “clean”)
      if (fromGroupId !== toGroupId) {
        // leave source group as-is, or you can set it to null / keep old value
      } else {
        // same group → just update the pointer (already done above)
      }

      return {
        promotedCount: toPromoteStudentIds.length,
        promoted: toPromoteStudentIds,
        skipped: toSkip,
      };
    },
    {
      maxWait: 10_000,
      timeout: 60_000,
    }
  );

  return result;
};
// ────────────────────────────────────────────────────────────
// Manually move one student (semester and/or group).
// Used for retakes, corrections, exceptions, group changes.
// ────────────────────────────────────────────────────────────
const promoteSingleStudent = async (payload: {
  studentId: number;
  toSemesterId: number;
  toGroupId?: number;
}) => {
  const { studentId, toSemesterId, toGroupId } = payload;

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      currentSemester: true,
      group: {
        include: {
          department: true,
          shift: true,
        },
      },
    },
  });
  if (!student) throw new ApiError(httpStatus.NOT_FOUND, "Student not found");

  const toSemester = await prisma.semester.findUnique({ where: { id: toSemesterId } });
  if (!toSemester) throw new ApiError(httpStatus.NOT_FOUND, "Target semester not found");

  if (toGroupId) {
    const targetGroup = await prisma.group.findUnique({ where: { id: toGroupId } });
    if (!targetGroup) throw new ApiError(httpStatus.NOT_FOUND, "Target group not found");
  }

  const result = await prisma.$transaction(async (tx) => {
    // Close current ONGOING enrollment (if any)
    if (student.currentSemesterId) {
      const currentEnrollment = await tx.studentEnrollment.findFirst({
        where: {
          studentId,
          semesterId: student.currentSemesterId,
          isDeleted: false,
        },
        orderBy: { attemptNumber: "desc" },
      });

      if (currentEnrollment && currentEnrollment.status === EnrollmentStatus.ONGOING) {
        await tx.studentEnrollment.update({
          where: { id: currentEnrollment.id },
          data: {
            status: EnrollmentStatus.DROPPED,
            endedAt: new Date(),
          },
        });
      }
    }

    const priorAttempts = await tx.studentEnrollment.count({
      where: { studentId, semesterId: toSemesterId },
    });

    const finalGroupId = toGroupId ?? student.groupId;

    const newEnrollment = await tx.studentEnrollment.create({
      data: {
        studentId,
        semesterId: toSemesterId,
        groupId: finalGroupId,
        attemptNumber: priorAttempts + 1,
        status: EnrollmentStatus.ONGOING,
      },
    });

    const updatedStudent = await tx.student.update({
      where: { id: studentId },
      data: {
        currentSemesterId: toSemesterId,
        currentAttempt: priorAttempts + 1,
        ...(toGroupId ? { groupId: toGroupId } : {}),
      },
      include: {
        currentSemester: true,
        group: {
          include: {
            department: true,
            shift: true,
          },
        },
      },
    });

    return { student: updatedStudent, enrollment: newEnrollment };
  });

  return result;
};

// ────────────────────────────────────────────────────────────
// Apply DiplomaResult → PASSED or RETAKING (+ rollback if needed)
// ────────────────────────────────────────────────────────────
const applyDiplomaResult = async (diplomaResultId: number) => {
  const diplomaResult = await prisma.diplomaResult.findUnique({
    where: { id: diplomaResultId },
    include: { student: true },
  });

  if (!diplomaResult) throw new ApiError(httpStatus.NOT_FOUND, "Diploma result not found");
  if (!diplomaResult.studentId || !diplomaResult.student) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Result is not linked to a student yet");
  }
  if (!diplomaResult.semesterId) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Result is not linked to a semester");
  }

  const { studentId, semesterId, student } = diplomaResult;
  const failCount =
    (diplomaResult.referredSubjects?.length ?? 0) +
    (diplomaResult.failedSubjects?.length ?? 0);

  const mustRetake =
    failCount >= FAIL_THRESHOLD || diplomaResult.status === DiplomaResultStatus.FAILED;

  const targetEnrollment = await prisma.studentEnrollment.findFirst({
    where: { studentId, semesterId },
    orderBy: { attemptNumber: "desc" },
  });

  if (!targetEnrollment) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "No matching enrollment found for this student/semester — cannot apply result"
    );
  }

  if (targetEnrollment.resultId) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "This enrollment already has a result applied"
    );
  }

  const outcome = await prisma.$transaction(async (tx) => {
    if (!mustRetake) {
      const updated = await tx.studentEnrollment.update({
        where: { id: targetEnrollment.id },
        data: {
          status: EnrollmentStatus.PASSED,
          resultId: diplomaResult.id,
          endedAt: targetEnrollment.endedAt ?? new Date(),
        },
      });
      return { action: "PASSED" as const, enrollment: updated };
    }

    // FAIL / RETAKE
    const failedEnrollment = await tx.studentEnrollment.update({
      where: { id: targetEnrollment.id },
      data: {
        status: EnrollmentStatus.RETAKING,
        resultId: diplomaResult.id,
        endedAt: new Date(),
      },
    });

    // If student has moved ahead, drop the further enrollment and roll back
    if (student.currentSemesterId && student.currentSemesterId !== semesterId) {
      const aheadEnrollment = await tx.studentEnrollment.findFirst({
        where: {
          studentId,
          semesterId: student.currentSemesterId,
          status: EnrollmentStatus.ONGOING,
        },
        orderBy: { attemptNumber: "desc" },
      });

      if (aheadEnrollment) {
        await tx.studentEnrollment.update({
          where: { id: aheadEnrollment.id },
          data: {
            status: EnrollmentStatus.DROPPED,
            endedAt: new Date(),
          },
        });
      }
    }

    const priorAttempts = await tx.studentEnrollment.count({
      where: { studentId, semesterId },
    });

    const retakeEnrollment = await tx.studentEnrollment.create({
      data: {
        studentId,
        semesterId,
        groupId: student.groupId,
        attemptNumber: priorAttempts + 1,
        status: EnrollmentStatus.ONGOING,
      },
    });

    await tx.student.update({
      where: { id: studentId },
      data: {
        currentSemesterId: semesterId,
        currentAttempt: priorAttempts + 1,
      },
    });

    return {
      action: "RETAKING" as const,
      enrollment: failedEnrollment,
      retakeEnrollment,
    };
  });

  return outcome;
};

// ────────────────────────────────────────────────────────────
// Helpers – always use these for listing
// ────────────────────────────────────────────────────────────
const getActiveEnrollment = async (studentId: number) => {
  const student = await prisma.student.findUnique({ where: { id: studentId } });
  if (!student) throw new ApiError(httpStatus.NOT_FOUND, "Student not found");
  if (!student.currentSemesterId) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Student has no current semester set");
  }

  const enrollment = await prisma.studentEnrollment.findFirst({
    where: {
      studentId,
      semesterId: student.currentSemesterId,
      isDeleted: false,
    },
    orderBy: { attemptNumber: "desc" },
    include: {
      semester: true,
      group: {
        include: {
          department: true,
          shift: true,
        },
      },
    },
  });

  if (!enrollment) throw new ApiError(httpStatus.NOT_FOUND, "No active enrollment found");
  return enrollment;
};

const getEnrollmentHistory = async (studentId: number) => {
  const student = await prisma.student.findUnique({ where: { id: studentId } });
  if (!student) throw new ApiError(httpStatus.NOT_FOUND, "Student not found");

  return prisma.studentEnrollment.findMany({
    where: { studentId, isDeleted: false },
    include: {
      semester: true,
      group: {
        include: {
          department: true,
          shift: true,
        },
      },
      result: true,
    },
    orderBy: [{ semesterId: "asc" }, { attemptNumber: "asc" }],
  });
};

/** Main cohort of a group in a specific semester (what you show in class lists) */
const getMainCohort = async (groupId: number, semesterId: number) => {
  return prisma.studentEnrollment.findMany({
    where: {
      groupId,
      semesterId,
      status: EnrollmentStatus.ONGOING,
      isDeleted: false,
    },
    include: {
      student: {
        select: {
          id: true,
          name: true,
          roll: true,
          registration: true,
          currentSemesterId: true,
          currentAttempt: true,
        },
      },
    },
    orderBy: { student: { roll: "asc" } },
  });
};

/** Students of a group who are still stuck / retaking an older semester */
const getRetakersOfGroup = async (groupId: number, semesterId: number) => {
  return prisma.studentEnrollment.findMany({
    where: {
      groupId,
      semesterId,
      status: EnrollmentStatus.RETAKING,
      isDeleted: false,
    },
    include: {
      student: {
        select: {
          id: true,
          name: true,
          roll: true,
          registration: true,
          currentSemesterId: true,
          currentAttempt: true,
        },
      },
    },
    orderBy: { student: { roll: "asc" } },
  });
};

export const enrollmentService = {
  promoteBatch,
  promoteSingleStudent,
  applyDiplomaResult,
  getActiveEnrollment,
  getEnrollmentHistory,
  getMainCohort,
  getRetakersOfGroup,
};