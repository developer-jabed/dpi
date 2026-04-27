import { prisma } from "../../shared/prisma";
import { Request } from "express";
import httpStatus from "http-status";
import ApiError from "../../errors/api.error";
import { paginationHelper } from "../../helper/paginationHelper";
import { Prisma } from "@prisma/client";

const groupSearchableFields = ["name", "session"];

// ── CREATE GROUP ─────────────────────────────────────────
const createGroup = async (req: Request) => {
  const { name, session, departmentId, shiftId, currentSemesterId } = req.body;

  if (!name || !session || !departmentId || !shiftId || !currentSemesterId) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "name, session, departmentId, shiftId and currentSemesterId are required"
    );
  }

  // validate relations exist
  const [department, shift, semester] = await Promise.all([
    prisma.department.findUnique({ where: { id: Number(departmentId) } }),
    prisma.shift.findUnique({ where: { id: Number(shiftId) } }),
    prisma.semester.findUnique({ where: { id: Number(currentSemesterId) } }),
  ]);

  if (!department || department.isDeleted) {
    throw new ApiError(httpStatus.NOT_FOUND, "Department not found");
  }
  if (!shift || shift.isDeleted) {
    throw new ApiError(httpStatus.NOT_FOUND, "Shift not found");
  }
  if (!semester || semester.isDeleted) {
    throw new ApiError(httpStatus.NOT_FOUND, "Semester not found");
  }

  // duplicate check — same name + session + department + shift
  const existing = await prisma.group.findFirst({
    where: {
      name,
      session,
      departmentId: Number(departmentId),
      shiftId: Number(shiftId),
      isDeleted: false,
    },
  });

  if (existing) {
    throw new ApiError(
      httpStatus.CONFLICT,
      `Group "${name}" already exists for this department, shift and session`
    );
  }

  return prisma.group.create({
    data: {
      name,
      session,
      departmentId: Number(departmentId),
      shiftId: Number(shiftId),
      currentSemesterId: Number(currentSemesterId),
    },
    include: {
      department: true,
      shift: true,
      currentSemester: true,
    },
  });
};

// ── GET ALL GROUPS ────────────────────────────────────────
const getAllGroups = async (filters: any, options: any) => {
  const { page, limit, skip } = paginationHelper.calculatePagination(options);
  const { searchTerm, departmentId, shiftId, semesterId, session } = filters;

  const andConditions: Prisma.GroupWhereInput[] = [
    { isDeleted: false },
  ];

  if (searchTerm) {
    andConditions.push({
      OR: groupSearchableFields.map((field) => ({
        [field]: { contains: searchTerm, mode: "insensitive" },
      })),
    });
  }

  if (departmentId) {
    andConditions.push({ departmentId: Number(departmentId) });
  }

  if (shiftId) {
    andConditions.push({ shiftId: Number(shiftId) });
  }

  // filter by current semester
  if (semesterId) {
    andConditions.push({ currentSemesterId: Number(semesterId) });
  }

  if (session) {
    andConditions.push({ session: { contains: session, mode: "insensitive" } });
  }

  const where: Prisma.GroupWhereInput = { AND: andConditions };

  const [data, total] = await Promise.all([
    prisma.group.findMany({
      where,
      skip,
      take: limit,
      orderBy: [
        { department: { name: "asc" } },
        { currentSemester: { order: "asc" } },
        { name: "asc" },
      ],
      include: {
        department: true,

        shift: true,
        currentSemester: true,
        crStudent: {
          select: {
            id: true,
            name: true,
            roll: true,
            profilePhoto: true,
          },
        },
        _count: {
          select: { students: true },
        },
      },
    }),
    prisma.group.count({ where }),
  ]);

  return {
    meta: { page, limit, total },
    data,
  };
};

// ── GET SINGLE GROUP BY ID ────────────────────────────────
const getGroupById = async (id: number) => {
  const group = await prisma.group.findUnique({
    where: { id },
    include: {
      department: true,
      shift: true,
      currentSemester: true,
      crStudent: {
        select: {
          id: true,
          name: true,
          roll: true,
          profilePhoto: true,
        },
      },
      students: {
        where: { isDeleted: false },
        include: { department: true },
        orderBy: { roll: "asc" },
      },
      diplomaResults: true,
      subjectGroups: {
        where: { isDeleted: false },
        include: {
          subject: true,
          teacher: {
            select: {
              id: true,
              name: true,
              designation: true,
            },
          },
        },
      },
    },
  });

  if (!group || group.isDeleted) {
    throw new ApiError(httpStatus.NOT_FOUND, "Group not found");
  }

  return group;
};

// ── PROMOTE GROUP TO NEXT SEMESTER ────────────────────────
const promoteGroup = async (id: number) => {
  const group = await prisma.group.findUnique({
    where: { id },
    include: { currentSemester: true },
  });

  if (!group || group.isDeleted) {
    throw new ApiError(httpStatus.NOT_FOUND, "Group not found");
  }

  const nextSemester = await prisma.semester.findFirst({
    where: { order: group.currentSemester.order + 1 },
  });

  if (!nextSemester) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Group is already in the final semester (8th)");
  }

  return prisma.group.update({
    where: { id },
    data: { currentSemesterId: nextSemester.id },
    include: {
      currentSemester: true,
      department: true,
      shift: true,
    },
  });
};

// ── ASSIGN CR TO GROUP ────────────────────────────────────
const assignCR = async (groupId: number, studentId: number) => {
  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group || group.isDeleted) {
    throw new ApiError(httpStatus.NOT_FOUND, "Group not found");
  }

  const student = await prisma.student.findUnique({ where: { id: studentId } });
  if (!student || student.isDeleted) {
    throw new ApiError(httpStatus.NOT_FOUND, "Student not found");
  }

  // student must belong to this group
  if (student.groupId !== groupId) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Student does not belong to this group");
  }

  return prisma.group.update({
    where: { id: groupId },
    data: { crStudentId: studentId },
    include: {
      crStudent: { select: { id: true, name: true, roll: true } },
      currentSemester: true,
      department: true,
      shift: true,
    },
  });
};

// ── SOFT DELETE ───────────────────────────────────────────
const deleteGroup = async (id: number) => {
  const group = await prisma.group.findUnique({ where: { id } });
  if (!group || group.isDeleted) {
    throw new ApiError(httpStatus.NOT_FOUND, "Group not found");
  }

  return prisma.group.update({
    where: { id },
    data: { isDeleted: true },
  });
};

export const groupService = {
  createGroup,
  getAllGroups,
  getGroupById,
  promoteGroup,
  assignCR,
  deleteGroup,
};