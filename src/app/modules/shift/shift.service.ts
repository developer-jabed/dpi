import { prisma } from "../../shared/prisma";
import { Request } from "express";
import httpStatus from "http-status";
import ApiError from "../../errors/api.error";

const createShift = async (req: Request) => {
  const { name } = req.body;

  if (!name) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Shift name is required");
  }

  const existingShift = await prisma.shift.findUnique({
    where: { name },
  });

  if (existingShift) {
    throw new ApiError(httpStatus.CONFLICT, "Shift already exists");
  }

  return prisma.shift.create({
    data: { name },
  });
};

const getAllShifts = async (req: Request) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const search = req.query.search as string | undefined;

  const skip = (page - 1) * limit;

  const where = search
    ? {
        name: {
          contains: search,
          mode: "insensitive" as const,
        },
      }
    : undefined;

  const [data, total] = await Promise.all([
    prisma.shift.findMany({
      where,
      skip,
      take: limit,
      orderBy: { id: "desc" },
    }),
    prisma.shift.count({ where }),
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

const getShiftById = async (id: number) => {
  const shift = await prisma.shift.findUnique({
    where: { id },
  });

  if (!shift) {
    throw new ApiError(httpStatus.NOT_FOUND, "Shift not found");
  }

  return shift;
};

export const shiftService = {
  createShift,
  getAllShifts,
  getShiftById,
};
