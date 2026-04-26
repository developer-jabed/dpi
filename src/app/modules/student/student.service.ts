// src/app/modules/student/student.service.ts

import { prisma } from '../../shared/prisma';
import { Prisma } from '@prisma/client';
import ApiError from '../../errors/api.error';
import httpStatus from 'http-status';
import { paginationHelper, PaginationOptions } from '../../helper/paginationHelper';
import { studentSearchableFields, studentSelectedFields } from './student.constant';

type FilterPayload = {
  searchTerm?: string;
  departmentId?: string;
  groupId?: string;
  gender?: string;
  isDeleted?: string;
};

export const studentService = {


  getAllStudents: async (filters: FilterPayload, paginationOptions: PaginationOptions) => {
    const { page, limit, skip, sortBy, sortOrder } =
      paginationHelper.calculatePagination(paginationOptions);

    const { searchTerm, departmentId, groupId, gender, isDeleted } = filters;

    const andConditions: Prisma.StudentWhereInput[] = [];

    // ── Search across multiple fields ──────────────────────────────
    if (searchTerm) {
      andConditions.push({
        OR: studentSearchableFields.map((field) => ({
          [field]: {
            contains: searchTerm,
            mode: 'insensitive' as Prisma.QueryMode,
          },
        })),
      });
    }

    // ── Exact filters ──────────────────────────────────────────────
    if (departmentId) {
      andConditions.push({ departmentId: Number(departmentId) });
    }

    if (groupId) {
      andConditions.push({ groupId: Number(groupId) });
    }

    if (gender) {
      andConditions.push({ gender });
    }

    // isDeleted filter — default to false (only active students)
    andConditions.push({
      isDeleted: isDeleted === 'true' ? true : false,
    });

    const where: Prisma.StudentWhereInput =
      andConditions.length > 0 ? { AND: andConditions } : {};

    const [students, total] = await Promise.all([
      prisma.student.findMany({
        where,
        select: studentSelectedFields,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      prisma.student.count({ where }),
    ]);

    return {
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      data: students,
    };
  },

  // ========================= GET STUDENT BY ID =========================
  getStudentById: async (id: number) => {
    const student = await prisma.student.findUnique({
      where: { id, isDeleted: false },
      select: studentSelectedFields,
    });

    if (!student) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Student not found');
    }

    return student;
  },

  // ========================= UPDATE STUDENT =========================
  updateStudent: async (id: number, payload: Prisma.StudentUpdateInput) => {
    const exists = await prisma.student.findUnique({
      where: { id, isDeleted: false },
    });

    if (!exists) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Student not found');
    }

    // Guard — prevent updating unique/sensitive fields accidentally
    const { userId, roll, registration, email, ...safePayload } = payload as any;

    const updated = await prisma.student.update({
      where: { id },
      data: safePayload,
      select: studentSelectedFields,
    });

    return updated;
  },

  // ========================= SOFT DELETE =========================
  softDeleteStudent: async (id: number) => {
    const exists = await prisma.student.findUnique({
      where: { id, isDeleted: false },
    });

    if (!exists) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Student not found or already deleted');
    }

    // Soft delete both student and user together
    const [student] = await prisma.$transaction([
      prisma.student.update({
        where: { id },
        data: { isDeleted: true },
        select: { id: true, name: true, email: true, isDeleted: true },
      }),
      prisma.user.update({
        where: { id: exists.userId },
        data: { isDeleted: true },
      }),
    ]);

    return student;
  },
};