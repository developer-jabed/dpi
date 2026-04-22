import { prisma } from "../../shared/prisma";
import { Request } from "express";
import httpStatus from "http-status";
import ApiError from "../../errors/api.error";

const createSemester = async (req: Request) => {
  const { name, order } = req.body;

  if (!name || !order) {
    throw new ApiError(httpStatus.BAD_REQUEST, "name and order are required");
  }

  if (order < 1 || order > 8) {
    throw new ApiError(httpStatus.BAD_REQUEST, "order must be between 1 and 8");
  }

  const existing = await prisma.semester.findFirst({
    where: {
      OR: [{ name }, { order }],
    },
  });

  if (existing) {
    throw new ApiError(httpStatus.CONFLICT, "Semester with this name or order already exists");
  }

  return prisma.semester.create({
    data: { name, order },
  });
};

const getAllSemesters = async (req: Request) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    prisma.semester.findMany({
      where: { isDeleted: false },
      skip,
      take: limit,
      orderBy: { order: "asc" },
    }),
    prisma.semester.count({ where: { isDeleted: false } }),
  ]);

  return {
    meta: { page, limit, total },
    data,
  };
};

const getSemesterById = async (id: number) => {
  const semester = await prisma.semester.findUnique({
    where: { id },
    include: {
      groups: {
        where: { isDeleted: false },
        include: {
          department: true,
          shift: true,
        },
      },
    },
  });

  if (!semester || semester.isDeleted) {
    throw new ApiError(httpStatus.NOT_FOUND, "Semester not found");
  }

  return semester;
};

const deleteSemester = async (id: number) => {
  const semester = await prisma.semester.findUnique({ where: { id } });

  if (!semester || semester.isDeleted) {
    throw new ApiError(httpStatus.NOT_FOUND, "Semester not found");
  }

  return prisma.semester.update({
    where: { id },
    data: { isDeleted: true },
  });
};

export const semesterService = {
  createSemester,
  getAllSemesters,
  getSemesterById,
  deleteSemester,
};