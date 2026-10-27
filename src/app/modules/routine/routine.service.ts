import { prisma } from "../../shared/prisma";
import ApiError from "../../errors/api.error";
import httpStatus from "http-status";
import { ICreateRoutine, IRoutineFilterRequest } from "./routine.interface";

const routineInclude = {
  subjectGroup: {
    include: {
      subject: true,
      teacher: true,
    },
  },
  group: {
    include: {
      shift: true,
      currentSemester: true,
    },
  },
} as const;

// ─────────────────────────────────────────────────────────────
// CREATE ROUTINE
// ─────────────────────────────────────────────────────────────
const createRoutine = async (payload: ICreateRoutine) => {
  const { groupId, subjectId, teacherId, ...slot } = payload;

  const [group, subject, teacher] = await Promise.all([
    prisma.group.findUnique({
      where: { id: groupId },
      select: { id: true, currentSemesterId: true },
    }),
    prisma.subject.findUnique({
      where: { id: subjectId },
      select: { id: true },
    }),
    prisma.teacher.findUnique({
      where: { id: teacherId },
      select: { id: true },
    }),
  ]);

  if (!group) {
    throw new ApiError(httpStatus.NOT_FOUND, "গ্রুপ পাওয়া যায়নি!");
  }
  if (!subject) {
    throw new ApiError(httpStatus.NOT_FOUND, "বিষয় পাওয়া যায়নি!");
  }
  if (!teacher) {
    throw new ApiError(httpStatus.NOT_FOUND, "শিক্ষক পাওয়া যায়নি!");
  }

  const semesterId = group.currentSemesterId;
  if (!semesterId) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "এই গ্রুপের জন্য কোনো বর্তমান সেমিস্টার নির্ধারণ করা নেই!",
    );
  }

  return prisma.$transaction(async (tx) => {
    // Check if the slot is already taken
    const existing = await tx.classRoutine.findFirst({
      where: {
        groupId,
        dayOfWeek: slot.dayOfWeek,
        period: slot.period,
      },
      select: { id: true },
    });

    if (existing) {
      throw new ApiError(
        httpStatus.CONFLICT,
        "এই গ্রুপে এই দিন ও পিরিয়ডের স্লটটি ইতিমধ্যে ব্যবহৃত হয়েছে!",
      );
    }

    // Find or create SubjectGroup
    let subjectGroup = await tx.subjectGroup.findFirst({
      where: { groupId, subjectId, semesterId },
      select: { id: true, teacherId: true },
    });

    if (!subjectGroup) {
      subjectGroup = await tx.subjectGroup.create({
        data: {
          groupId,
          subjectId,
          semesterId,
          teacherId,
        },
        select: { id: true, teacherId: true },
      });
    } else if (subjectGroup.teacherId !== teacherId) {
      // Update teacher if different
      await tx.subjectGroup.update({
        where: { id: subjectGroup.id },
        data: { teacherId },
      });
    }

    return tx.classRoutine.create({
      data: {
        groupId,
        subjectGroupId: subjectGroup.id,
        dayOfWeek: slot.dayOfWeek,
        period: slot.period,
        startTime: slot.startTime,
        endTime: slot.endTime,
        room: slot.room,
        ...(slot.isActive !== undefined && { isActive: slot.isActive }),
      },
      include: routineInclude,
    });
  });
};

// ─────────────────────────────────────────────────────────────
// GET ALL ROUTINES (Admin / filterable)
// ─────────────────────────────────────────────────────────────
const getAllRoutines = async (filters: IRoutineFilterRequest) => {
  const { groupId, dayOfWeek, semesterId } = filters;

  return prisma.classRoutine.findMany({
    where: {
      isActive: true,
      ...(groupId && { groupId: Number(groupId) }),
      ...(dayOfWeek !== undefined && { dayOfWeek: Number(dayOfWeek) }),
      ...(semesterId && {
        group: {
          currentSemesterId: Number(semesterId),
        },
      }),
    },
    include: routineInclude,
    orderBy: [{ dayOfWeek: "asc" }, { period: "asc" }],
  });
};

// ─────────────────────────────────────────────────────────────
// GET ROUTINE BY GROUP
// ─────────────────────────────────────────────────────────────
const getRoutineByGroup = async (groupId: number) => {
  return prisma.classRoutine.findMany({
    where: {
      groupId,
      isActive: true,
    },
    include: routineInclude,
    orderBy: [{ dayOfWeek: "asc" }, { period: "asc" }],
  });
};




const getMyRoutines = async (user: { userId: number; role: string }) => {
  // ── Teacher ───────────────────────────────────────────────
  if (user.role === "TEACHER") {
    const teacher = await prisma.teacher.findUnique({
      where: { userId: user.userId },
      select: { id: true },
    });

    if (!teacher) {
      throw new ApiError(httpStatus.NOT_FOUND, "Teacher profile not found");
    }

    return prisma.classRoutine.findMany({
      where: {
        isActive: true,
        subjectGroup: {
          teacherId: teacher.id,
          isDeleted: false,
        },
      },
      include: routineInclude,
      orderBy: [{ dayOfWeek: "asc" }, { period: "asc" }],
    });
  }

  // ── Student ───────────────────────────────────────────────
 console.log("=== getMyRoutines Debug ===");
  console.log("userId:", user.userId);
  console.log("role:", user.role);

  if (user.role === "STUDENT") {
    const student = await prisma.student.findUnique({
      where: { userId: user.userId },
      select: {
        id: true,
        groupId: true,
        name: true,
        enrollments: {
          where: {
            status: "ONGOING",
            isDeleted: false,
          },
          orderBy: { startedAt: "desc" },
          take: 1,
          select: {
            id: true,
            groupId: true,
            status: true,
          },
        },
      },
    });

    console.log("Student found:", student);

    if (!student) {
      throw new ApiError(httpStatus.NOT_FOUND, "Student profile not found");
    }

    const groupId = student.enrollments[0]?.groupId || student.groupId;
    console.log("Using groupId:", groupId);

    if (!groupId) {
      console.log("No groupId found for this student");
      return [];
    }

    const routines = await prisma.classRoutine.findMany({
      where: {
        groupId,
        isActive: true,
      },
      include: routineInclude,
      orderBy: [{ dayOfWeek: "asc" }, { period: "asc" }],
    });

    console.log("Routines found:", routines.length);
    return routines;
  }

  throw new ApiError(
    httpStatus.FORBIDDEN,
    "Only Teacher and Student can access My Routine",
  );
};
export const routineService = {
  createRoutine,
  getAllRoutines,
  getRoutineByGroup,
  getMyRoutines,
};