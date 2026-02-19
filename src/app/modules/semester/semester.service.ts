import { prisma } from "../../shared/prisma";
import { Request } from "express";
import httpStatus from "http-status";
import { ISemesterFilters } from "./semester.interface";
import ApiError from "../../errors/api.error";

const createSemester = async (req: Request) => {
  const { semesterNo, departmentId, shiftId } = req.body;

  if (!semesterNo || !departmentId || !shiftId) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "semesterNo, departmentId and shiftId are required"
    );
  }

  const existingSemester = await prisma.semester.findFirst({
    where: {
      semesterNo,
      departmentId,
      shiftId,
    },
  });

  if (existingSemester) {
    throw new ApiError(
      httpStatus.CONFLICT,
      "Semester already exists for this department & shift"
    );
  }

  return prisma.semester.create({
    data: {
      semesterNo,
      departmentId,
      shiftId,
    },
  });
};

const getAllSemesters = async (req: Request) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const filters: ISemesterFilters = {
    departmentId: req.query.departmentId
      ? Number(req.query.departmentId)
      : undefined,
    shiftId: req.query.shiftId
      ? Number(req.query.shiftId)
      : undefined,
  };

  const andConditions: any[] = [];

  if (filters.departmentId) {
    andConditions.push({ departmentId: filters.departmentId });
  }

  if (filters.shiftId) {
    andConditions.push({ shiftId: filters.shiftId });
  }

  const whereCondition =
    andConditions.length > 0 ? { AND: andConditions } : {};

  const [data, total] = await Promise.all([
    prisma.semester.findMany({
      where: whereCondition,
      skip,
      take: limit,
      orderBy: { semesterNo: "asc" },
      include: {
        department: true,
        shift: true,
      },
    }),
    prisma.semester.count({ where: whereCondition }),
  ]);

  return {
    meta: {
      page,
      limit,
      total,
    },
    data,
  };
};

const getSemesterById = async (id: number) => {
  const semester = await prisma.semester.findUnique({
    where: { id },
    include: {
      department: true,
      shift: true,
      groups: true,
    },
  });

  if (!semester) {
    throw new ApiError(httpStatus.NOT_FOUND, "Semester not found");
  }

  return semester;
};

export const semesterService = {
  createSemester,
  getAllSemesters,
  getSemesterById,
};
