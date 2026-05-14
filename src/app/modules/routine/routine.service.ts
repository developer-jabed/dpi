import { prisma } from "../../shared/prisma";
import ApiError from "../../errors/api.error";
import httpStatus from "http-status";
import { ICreateRoutine, IRoutineFilterRequest } from "./routine.interface";

const createRoutine = async (payload: ICreateRoutine) => {
  const existing = await prisma.classRoutine.findFirst({
    where: {
      groupId: payload.groupId,
      dayOfWeek: payload.dayOfWeek,
      period: payload.period,
    },
  });

  if (existing) {
    throw new ApiError(
      httpStatus.CONFLICT,
      "Slot already occupied in this group",
    );
  }

  const result = await prisma.classRoutine.create({
    data: payload,
    include: {
      subjectGroup: {
        include: {
          subject: true,
          teacher: true,
        },
      },
      group: {
        include: {
          currentSemester: true,
        },
      },
    },
  });

  return result;
};

const getAllRoutines = async (filters: IRoutineFilterRequest) => {
  const { groupId, dayOfWeek, semesterId } = filters;

  const result = await prisma.classRoutine.findMany({
    where: {
      isActive: true,
      ...(groupId && { groupId }),
      ...(dayOfWeek !== undefined && { dayOfWeek }),
      ...(semesterId && { group: { currentSemesterId: semesterId } }),
    },
    include: {
      subjectGroup: {
        include: {
          subject: true,
          teacher: true,
        },
      },
      group: {
        include: {
          currentSemester: true,
        },
      },
    },
    orderBy: [{ dayOfWeek: "asc" }, { period: "asc" }],
  });

  return result;
};

const getRoutineByGroup = async (groupId: number) => {
  return prisma.classRoutine.findMany({
    where: { groupId, isActive: true },
    include: {
      subjectGroup: {
        include: { subject: true, teacher: true },
      },
    },
    orderBy: [{ dayOfWeek: "asc" }, { period: "asc" }],
  });
};

export const routineService = {
  createRoutine,
  getAllRoutines,
  getRoutineByGroup,
};
