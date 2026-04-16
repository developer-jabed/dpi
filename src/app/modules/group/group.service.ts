import { prisma } from "../../shared/prisma";
import { Request } from "express";
import httpStatus from "http-status";
import ApiError from "../../errors/api.error";
import { paginationHelper } from "../../helper/paginationHelper";
import { Prisma } from "@prisma/client";

const groupSearchableFields = ["name"];

// ── CREATE GROUP ─────────────────────────────────────────
const createGroup = async (req: Request) => {
  const { name, semesterId } = req.body;

  if (!name || !semesterId) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Name and semesterId are required");
  }

  const semester = await prisma.semester.findUnique({
    where: { id: Number(semesterId) },
    include: { department: true, shift: true },
  });

  if (!semester) {
    throw new ApiError(httpStatus.NOT_FOUND, "Semester not found");
  }

  // Check duplicate group name in same semester
  const existingGroup = await prisma.group.findFirst({
    where: {
      name,
      semesterId: Number(semesterId),
    },
  });

  if (existingGroup) {
    throw new ApiError(
      httpStatus.CONFLICT,
      `Group "${name}" already exists in this semester`
    );
  }

  const group = await prisma.group.create({
    data: {
      name,
      semesterId: Number(semesterId),
    },
    include: {
      semester: {
        include: {
          shift: true,
          department: true,
        },
      },
      students: {
        where: { isDeleted: false },
        include: {
          user: true,
          department: true,
        },
        orderBy: { roll: "asc" },
      },
    },
  });

  return group;
};

// ── GET ALL GROUPS WITH ADVANCED FILTER ───────────────────
const getAllGroups = async (filters: any, options: any) => {
  const { page, limit, skip } = paginationHelper.calculatePagination(options);
  const { searchTerm, departmentId, shiftId, semesterId, ...filterData } = filters;

  const andConditions: Prisma.GroupWhereInput[] = [];

  // Search by group name
  if (searchTerm) {
    andConditions.push({
      OR: groupSearchableFields.map((field) => ({
        [field]: { contains: searchTerm, mode: "insensitive" },
      })),
    });
  }

  // Filter by Department
  if (departmentId) {
    andConditions.push({
      semester: {
        departmentId: Number(departmentId),
      },
    });
  }

  // Filter by Shift
  if (shiftId) {
    andConditions.push({
      semester: {
        shiftId: Number(shiftId),
      },
    });
  }

  // Filter by Semester
  if (semesterId) {
    andConditions.push({
      semesterId: Number(semesterId),
    });
  }

  // Other filters (if any)
  if (Object.keys(filterData).length > 0) {
    andConditions.push({
      AND: Object.entries(filterData).map(([key, value]) => ({
        [key]: { equals: value },
      })),
    });
  }

  const whereConditions =
    andConditions.length > 0 ? { AND: andConditions } : {};

  const data = await prisma.group.findMany({
    where: whereConditions,
    skip,
    take: limit,
    orderBy: { id: "desc" },
    include: {
      semester: {
        include: {
          shift: true,
          department: true,
        },
      },
      students: {
        where: { isDeleted: false },
        include: {
          user: true,
          department: true,
          diplomaResults: true,
        },
        orderBy: { roll: "asc" },
      },
    },
  });

  const total = await prisma.group.count({ where: whereConditions });

  return {
    meta: { page, limit, total },
    data,
  };
};

// ── GET SINGLE GROUP BY ID ───────────────────────────────
const getGroupById = async (id: number) => {
  const group = await prisma.group.findUnique({
    where: { id },
    include: {
      semester: {
        include: {
          shift: true,
          department: true,
        },
      },
      students: {
        where: { isDeleted: false },
        include: {
          user: true,
          department: true,
        },
        orderBy: { roll: "asc" },
      },
    },
  });

  if (!group) {
    throw new ApiError(httpStatus.NOT_FOUND, "Group not found");
  }

  return group;
};

export const groupService = {
  createGroup,
  getAllGroups,
  getGroupById,
};