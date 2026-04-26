// subjectGroup.service.ts

import { prisma } from '../../shared/prisma';
import { Prisma } from '@prisma/client';
import ApiError from '../../errors/api.error';
import httpStatus from 'http-status';
import { paginationHelper } from '../../helper/paginationHelper';
import { subjectGroupSortableFields } from './subjectGroup.constant';
import {
  ISubjectGroupFilterRequest,
  TSubjectGroupCreate,
  TSubjectGroupUpdate,
} from './subjectGroup.interface';

// ─── Reusable include ────────────────────────────────────────────────────────
const subjectGroupInclude = {
  teacher:  true,
  subject:  true,
  group:    true,
  semester: true,
} satisfies Prisma.SubjectGroupInclude;

// ─── Helper ──────────────────────────────────────────────────────────────────
const findOrThrow = async (id: number) => {
  const record = await prisma.subjectGroup.findUnique({ where: { id } });
  if (!record) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Subject group not found');
  }
  return record;
};

// ─── Service ─────────────────────────────────────────────────────────────────
const createSubjectGroup = async (payload: TSubjectGroupCreate) => {
  const existing = await prisma.subjectGroup.findUnique({
    where: {
      teacherId_subjectId_groupId_semesterId: {
        teacherId:  payload.teacherId,
        subjectId:  payload.subjectId,
        groupId:    payload.groupId,
        semesterId: payload.semesterId,
      },
    },
  });

  if (existing) {
    throw new ApiError(
      httpStatus.CONFLICT,
      'This subject is already assigned to the group for this teacher & semester',
    );
  }

  return prisma.subjectGroup.create({
    data:    payload,
    include: subjectGroupInclude,
  });
};

const getAllSubjectGroups = async (filters: ISubjectGroupFilterRequest) => {
  const { searchTerm, page, limit, sortBy, sortOrder, ...filterData } = filters;

  const andConditions: Prisma.SubjectGroupWhereInput[] = [];

  // ── Relational search ──
  if (searchTerm?.trim()) {
    andConditions.push({
      OR: [
        { subject:  { name: { contains: searchTerm.trim(), mode: 'insensitive' } } },
        { subject:  { code: { contains: searchTerm.trim(), mode: 'insensitive' } } },
        { group:    { name: { contains: searchTerm.trim(), mode: 'insensitive' } } },
        { teacher:  { name: { contains: searchTerm.trim(), mode: 'insensitive' } } },
        { semester: { name: { contains: searchTerm.trim(), mode: 'insensitive' } } },
      ],
    });
  }

  // ── Exact-match filters (teacherId, subjectId, groupId, semesterId, isDeleted) ──
  if (Object.keys(filterData).length > 0) {
    const filterConditions = Object.entries(filterData)
      .filter(([_, value]) => value != null)
      .map(([field, value]) => ({ [field]: value }));

    if (filterConditions.length > 0) {
      andConditions.push({ AND: filterConditions });
    }
  }

  const where: Prisma.SubjectGroupWhereInput =
    andConditions.length > 0 ? { AND: andConditions } : {};

  // ── Pagination ──
  const pagination = paginationHelper.calculatePagination({
    page,
    limit,
    sortBy,
    sortOrder,
  });

  if (!subjectGroupSortableFields.includes(pagination.sortBy as any)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid sortBy field');
  }

  const orderBy: Prisma.SubjectGroupOrderByWithRelationInput = {
    [pagination.sortBy]: pagination.sortOrder,
  };

  const [data, total] = await Promise.all([
    prisma.subjectGroup.findMany({
      where,
      include: subjectGroupInclude,
      orderBy,
      skip: pagination.skip,
      take: pagination.limit,
    }),
    prisma.subjectGroup.count({ where }),
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

const getSingleSubjectGroup = async (id: number) => {
  const result = await prisma.subjectGroup.findUnique({
    where:   { id },
    include: subjectGroupInclude,
  });

  if (!result) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Subject group not found');
  }

  return result;
};

const getLoginTeacherSubjectGroups = async (teacherId: number) => {
  return prisma.subjectGroup.findMany({
    where:   { teacherId, isDeleted: false },
    include: subjectGroupInclude,
  });
};

const updateSubjectGroup = async (id: number, payload: TSubjectGroupUpdate) => {
  const current = await findOrThrow(id);

  // Merge payload with current to check full unique key
  const newTeacherId  = payload.teacherId  ?? current.teacherId;
  const newSubjectId  = payload.subjectId  ?? current.subjectId;
  const newGroupId    = payload.groupId    ?? current.groupId;
  const newSemesterId = payload.semesterId ?? current.semesterId;

  const conflict = await prisma.subjectGroup.findUnique({
    where: {
      teacherId_subjectId_groupId_semesterId: {
        teacherId:  newTeacherId,
        subjectId:  newSubjectId,
        groupId:    newGroupId,
        semesterId: newSemesterId,
      },
      NOT: { id },   // exclude self
    },
  });

  if (conflict) {
    throw new ApiError(
      httpStatus.CONFLICT,
      'This subject is already assigned to the group for this teacher & semester',
    );
  }

  return prisma.subjectGroup.update({
    where: { id },
    data: {
      teacherId:  payload.teacherId,
      subjectId:  payload.subjectId,
      groupId:    payload.groupId,
      semesterId: payload.semesterId,
    },
    include: subjectGroupInclude,
  });
};

const deleteSubjectGroup = async (id: number) => {
  const current = await findOrThrow(id);

  // Block delete if attendance sessions exist
  const hasAttendance = await prisma.attendanceSession.count({
    where: {
      groupId:   current.groupId,
      subjectId: current.subjectId,
    },
  });

  if (hasAttendance > 0) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Cannot delete subject group with existing attendance sessions',
    );
  }

  // Soft delete
  return prisma.subjectGroup.update({
    where: { id },
    data:  { isDeleted: true },
  });
};

export const subjectGroupService = {
  createSubjectGroup,
  getAllSubjectGroups,
  getSingleSubjectGroup,
  getLoginTeacherSubjectGroups,
  updateSubjectGroup,
  deleteSubjectGroup,
};