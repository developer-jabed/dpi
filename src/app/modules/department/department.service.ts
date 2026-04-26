// department.service.ts

import { prisma } from '../../shared/prisma';
import { Prisma } from '@prisma/client';
import ApiError from '../../errors/api.error';
import httpStatus from 'http-status';
import { paginationHelper } from '../../helper/paginationHelper';
import { departmentSearchableFields, departmentSortableFields } from './department.constant';
import { IDepartmentFilterRequest, TDepartmentCreate, TDepartmentUpdate } from './department.interface';

// ─── Reusable include ────────────────────────────────────────────────────────
const departmentInclude = {
  shifts:   true,
  subjects: true,
} satisfies Prisma.DepartmentInclude;

// ─── Helper ──────────────────────────────────────────────────────────────────
const findOrThrow = async (id: number) => {
  const record = await prisma.department.findUnique({ where: { id } });
  if (!record) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Department not found');
  }
  return record;
};

// ─── Service ─────────────────────────────────────────────────────────────────
const createDepartment = async (payload: TDepartmentCreate) => {
  // name is @unique in schema — use findUnique
  const existing = await prisma.department.findUnique({
    where: { name: payload.name },
  });

  if (existing) {
    throw new ApiError(
      httpStatus.CONFLICT,
      'Department with this name already exists',
    );
  }

  return prisma.department.create({
    data:    payload,
    include: departmentInclude,
  });
};

const getAllDepartments = async (filters: IDepartmentFilterRequest) => {
  const { searchTerm, page, limit, sortBy, sortOrder, ...filterData } = filters;

  const andConditions: Prisma.DepartmentWhereInput[] = [];

  // ── Search ──
  if (searchTerm?.trim()) {
    andConditions.push({
      OR: departmentSearchableFields.map((field) => ({
        [field]: { contains: searchTerm.trim(), mode: 'insensitive' },
      })),
    });
  }

  // ── Exact-match filters (isDeleted) ──
  if (Object.keys(filterData).length > 0) {
    const filterConditions = Object.entries(filterData)
      .filter(([_, value]) => value != null)
      .map(([field, value]) => ({ [field]: value }));

    if (filterConditions.length > 0) {
      andConditions.push({ AND: filterConditions });
    }
  }

  const where: Prisma.DepartmentWhereInput =
    andConditions.length > 0 ? { AND: andConditions } : {};

  // ── Pagination ──
  const pagination = paginationHelper.calculatePagination({
    page,
    limit,
    sortBy,
    sortOrder,
  });

  if (!departmentSortableFields.includes(pagination.sortBy as any)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid sortBy field');
  }

  const orderBy: Prisma.DepartmentOrderByWithRelationInput = {
    [pagination.sortBy]: pagination.sortOrder,
  };

  const [data, total] = await Promise.all([
    prisma.department.findMany({
      where,
      include: departmentInclude,
      orderBy,
      skip: pagination.skip,
      take: pagination.limit,
    }),
    prisma.department.count({ where }),
  ]);

  const totalPages = Math.ceil(total / pagination.limit);

  return {
    meta: {
      page:      pagination.page,
      limit:     pagination.limit,
      total,
      totalPages,
      hasNext:   pagination.page < totalPages,
      hasPrev:   pagination.page > 1,
    },
    data,
  };
};

const getSingleDepartment = async (id: number) => {
  const result = await prisma.department.findUnique({
    where:   { id },
    include: {
      shifts:   true,
      groups:   true,
      subjects: true,
      teachers: true,
      students: true,
    },
  });

  if (!result) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Department not found');
  }

  return result;
};

const updateDepartment = async (id: number, payload: TDepartmentUpdate) => {
  const current = await findOrThrow(id);

  // Check name conflict if name is changing
  if (payload.name && payload.name !== current.name) {
    const conflict = await prisma.department.findUnique({
      where: { name: payload.name },
    });

    if (conflict) {
      throw new ApiError(
        httpStatus.CONFLICT,
        'Department with this name already exists',
      );
    }
  }

  return prisma.department.update({
    where: { id },
    data: {
      name:      payload.name,
      shortName: payload.shortName,
    },
    include: departmentInclude,
  });
};

const deleteDepartment = async (id: number) => {
  await findOrThrow(id);

  // Block delete if any related records exist
  const [hasShifts, hasGroups, hasSubjects, hasTeachers, hasStudents] =
    await Promise.all([
      prisma.shift.count({   where: { departmentId: id } }),
      prisma.group.count({   where: { departmentId: id } }),
      prisma.subject.count({ where: { departmentId: id } }),
      prisma.teacher.count({ where: { departmentId: id } }),
      prisma.student.count({ where: { departmentId: id } }),
    ]);

  if (hasShifts > 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Cannot delete department with associated shifts');
  }
  if (hasGroups > 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Cannot delete department with associated groups');
  }
  if (hasSubjects > 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Cannot delete department with associated subjects');
  }
  if (hasTeachers > 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Cannot delete department with associated teachers');
  }
  if (hasStudents > 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Cannot delete department with associated students');
  }

  // Soft delete
  return prisma.department.update({
    where: { id },
    data:  { isDeleted: true },
  });
};

export const departmentService = {
  createDepartment,
  getAllDepartments,
  getSingleDepartment,
  updateDepartment,
  deleteDepartment,
};