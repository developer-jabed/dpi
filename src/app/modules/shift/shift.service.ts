// shift.service.ts

import { prisma } from '../../shared/prisma';
import { Prisma } from '@prisma/client';
import ApiError from '../../errors/api.error';
import httpStatus from 'http-status';
import { paginationHelper } from '../../helper/paginationHelper';
import { shiftSearchableFields, shiftSortableFields } from './shift.constant';
import { IShiftFilterRequest, TShiftCreate, TShiftUpdate } from './shift.interface';

// ─── Reusable include ────────────────────────────────────────────────────────
const shiftInclude = {
  department: true,
} satisfies Prisma.ShiftInclude;

// ─── Helper ──────────────────────────────────────────────────────────────────
const findOrThrow = async (id: number) => {
  const record = await prisma.shift.findUnique({ where: { id } });
  if (!record) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Shift not found');
  }
  return record;
};

// ─── Service ─────────────────────────────────────────────────────────────────
const createShift = async (payload: TShiftCreate) => {
  // name is not @unique in schema — check name + departmentId combo
  const existing = await prisma.shift.findFirst({
    where: {
      name:         payload.name,
      departmentId: payload.departmentId,
      isDeleted:    false,
    },
  });

  if (existing) {
    throw new ApiError(
      httpStatus.CONFLICT,
      'Shift with this name already exists in the department',
    );
  }

  return prisma.shift.create({
    data:    payload,
    include: shiftInclude,
  });
};

const getAllShifts = async (filters: IShiftFilterRequest) => {
  const { searchTerm, page, limit, sortBy, sortOrder, ...filterData } = filters;

  const andConditions: Prisma.ShiftWhereInput[] = [];

  // ── Search ──
  if (searchTerm?.trim()) {
    andConditions.push({
      OR: shiftSearchableFields.map((field) => ({
        [field]: { contains: searchTerm.trim(), mode: 'insensitive' },
      })),
    });
  }

  // ── Exact-match filters (departmentId, isDeleted) ──
  if (Object.keys(filterData).length > 0) {
    const filterConditions = Object.entries(filterData)
      .filter(([_, value]) => value != null)
      .map(([field, value]) => ({ [field]: value }));

    if (filterConditions.length > 0) {
      andConditions.push({ AND: filterConditions });
    }
  }

  const where: Prisma.ShiftWhereInput =
    andConditions.length > 0 ? { AND: andConditions } : {};

  // ── Pagination ──
  const pagination = paginationHelper.calculatePagination({
    page,
    limit,
    sortBy,
    sortOrder,
  });

  if (!shiftSortableFields.includes(pagination.sortBy as any)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid sortBy field');
  }

  const orderBy: Prisma.ShiftOrderByWithRelationInput = {
    [pagination.sortBy]: pagination.sortOrder,
  };

  const [data, total] = await Promise.all([
    prisma.shift.findMany({
      where,
      include: shiftInclude,
      orderBy,
      skip: pagination.skip,
      take: pagination.limit,
    }),
    prisma.shift.count({ where }),
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

const getSingleShift = async (id: number) => {
  const result = await prisma.shift.findUnique({
    where:   { id },
    include: {
      ...shiftInclude,
      groups: true,   // extra detail for single view
    },
  });

  if (!result) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Shift not found');
  }

  return result;
};

const updateShift = async (id: number, payload: TShiftUpdate) => {
  const current = await findOrThrow(id);

  // Check name + departmentId combo conflict if either is changing
  if (payload.name || payload.departmentId) {
    const newName         = payload.name         ?? current.name;
    const newDepartmentId = payload.departmentId ?? current.departmentId;

    const conflict = await prisma.shift.findFirst({
      where: {
        name:         newName,
        departmentId: newDepartmentId,
        isDeleted:    false,
        NOT: { id },
      },
    });

    if (conflict) {
      throw new ApiError(
        httpStatus.CONFLICT,
        'Shift with this name already exists in the department',
      );
    }
  }

  return prisma.shift.update({
    where: { id },
    data: {
      name:         payload.name,
      shortName:    payload.shortName,
      departmentId: payload.departmentId,
    },
    include: shiftInclude,
  });
};

const deleteShift = async (id: number) => {
  await findOrThrow(id);

  // Block delete if groups are linked
  const hasGroups = await prisma.group.count({
    where: { shiftId: id },
  });

  if (hasGroups > 0) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Cannot delete shift with associated groups',
    );
  }

  // Soft delete
  return prisma.shift.update({
    where: { id },
    data:  { isDeleted: true },
  });
};

export const shiftService = {
  createShift,
  getAllShifts,
  getSingleShift,
  updateShift,
  deleteShift,
};