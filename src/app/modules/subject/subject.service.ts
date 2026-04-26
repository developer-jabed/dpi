// subject.service.ts

import { prisma } from '../../shared/prisma';
import { Prisma } from '@prisma/client';
import ApiError from '../../errors/api.error';
import httpStatus from 'http-status';
import { paginationHelper } from '../../helper/paginationHelper';
import { subjectSearchableFields, subjectSortableFields } from './subject.constant';
import { ISubjectFilterRequest, TSubjectCreate, TSubjectUpdate } from './subject.interface';

// ─── Reusable include ────────────────────────────────────────────────────────
const subjectInclude = {
  semester:   true,
  department: true,
} satisfies Prisma.SubjectInclude;

// ─── Helper ──────────────────────────────────────────────────────────────────
const findOrThrow = async (id: number) => {
  const record = await prisma.subject.findUnique({ where: { id } });
  if (!record) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Subject not found');
  }
  return record;
};

// ─── Service ─────────────────────────────────────────────────────────────────
const createSubject = async (payload: TSubjectCreate) => {
  const existing = await prisma.subject.findUnique({
    where: { code: payload.code },
  });

  if (existing) {
    throw new ApiError(httpStatus.CONFLICT, 'Subject code already exists');
  }

  return prisma.subject.create({
    data:    payload,
    include: subjectInclude,
  });
};

const getAllSubjects = async (filters: ISubjectFilterRequest) => {
  const { searchTerm, page, limit, sortBy, sortOrder, ...filterData } = filters;

  const andConditions: Prisma.SubjectWhereInput[] = [];

  // ── Search across scalar fields ──
  if (searchTerm?.trim()) {
    andConditions.push({
      OR: subjectSearchableFields.map((field) => ({
        [field]: { contains: searchTerm.trim(), mode: 'insensitive' },
      })),
    });
  }

  // ── Exact-match filters (semesterId, departmentId, isDeleted) ──
  if (Object.keys(filterData).length > 0) {
    const filterConditions = Object.entries(filterData)
      .filter(([_, value]) => value != null)
      .map(([field, value]) => ({ [field]: value }));

    if (filterConditions.length > 0) {
      andConditions.push({ AND: filterConditions });
    }
  }

  const where: Prisma.SubjectWhereInput =
    andConditions.length > 0 ? { AND: andConditions } : {};

  // ── Pagination ──
  const pagination = paginationHelper.calculatePagination({
    page,
    limit,
    sortBy,
    sortOrder,
  });

  if (!subjectSortableFields.includes(pagination.sortBy as any)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid sortBy field');
  }

  const orderBy: Prisma.SubjectOrderByWithRelationInput = {
    [pagination.sortBy]: pagination.sortOrder,
  };

  const [data, total] = await Promise.all([
    prisma.subject.findMany({
      where,
      include: subjectInclude,
      orderBy,
      skip: pagination.skip,
      take: pagination.limit,
    }),
    prisma.subject.count({ where }),
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

const getSingleSubject = async (id: number) => {
  const result = await prisma.subject.findUnique({
    where:   { id },
    include: {
      ...subjectInclude,
      subjectGroups: true,   // extra detail for single view
    },
  });

  if (!result) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Subject not found');
  }

  return result;
};

const updateSubject = async (id: number, payload: TSubjectUpdate) => {
  const subject = await findOrThrow(id);

  // Prevent duplicate code on update
  if (payload.code && payload.code !== subject.code) {
    const duplicate = await prisma.subject.findUnique({
      where: { code: payload.code },
    });
    if (duplicate) {
      throw new ApiError(httpStatus.CONFLICT, 'Subject code already in use');
    }
  }

  return prisma.subject.update({
    where:   { id },
    data: {
      name:         payload.name,
      shortName:    payload.shortName,
      code:         payload.code,
      semesterId:   payload.semesterId,
      departmentId: payload.departmentId,
      totalClasses: payload.totalClasses,
    },
    include: subjectInclude,
  });
};

const deleteSubject = async (id: number) => {
  await findOrThrow(id);

  // Block delete if subject groups exist
  const hasGroups = await prisma.subjectGroup.count({
    where: { subjectId: id },
  });

  if (hasGroups > 0) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Cannot delete subject with associated groups',
    );
  }

  // Block delete if attendance sessions exist
  const hasAttendance = await prisma.attendanceSession.count({
    where: { subjectId: id },
  });

  if (hasAttendance > 0) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Cannot delete subject with existing attendance sessions',
    );
  }

  return prisma.subject.update({
    where: { id },
    data:  { isDeleted: true },     // soft delete
  });
};

export const subjectService = {
  createSubject,
  getAllSubjects,
  getSingleSubject,
  updateSubject,
  deleteSubject,
};