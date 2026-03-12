import { prisma } from '../../shared/prisma';
import { Prisma } from '@prisma/client';
import ApiError from '../../errors/api.error';
import httpStatus from 'http-status';
import { paginationHelper } from '../../helper/paginationHelper';
import { subjectSearchableFields, subjectSortableFields } from './subject.constant';
import { ISubjectFilterRequest, TSubjectCreate, TSubjectUpdate } from './subject.interface';

const createSubject = async (payload: TSubjectCreate) => {

  const existing = await prisma.subject.findUnique({
    where: { code: payload.code },
  });

  if (existing) {
    throw new ApiError(httpStatus.CONFLICT, 'Subject code already exists');
  }

  const result = await prisma.subject.create({
    data: payload,
  });

  return result;
};

const getAllSubjects = async (filters: ISubjectFilterRequest) => {
  const {
    searchTerm,

    page,
    limit,
    sortBy,
    sortOrder,
    ...filterData
  } = filters;


  const andConditions: Prisma.SubjectWhereInput[] = [];


  if (searchTerm?.trim()) {
    andConditions.push({
      OR: subjectSearchableFields.map((field) => ({
        [field]: {
          contains: searchTerm.trim(),
          mode: 'insensitive',
        },
      })),
    });
  }


  if (Object.keys(filterData).length > 0) {
    const filterConditions = Object.entries(filterData)
      .filter(([_, value]) => value != null)
      .map(([field, value]) => ({
        [field]: value,
      }));

    if (filterConditions.length > 0) {
      andConditions.push({ AND: filterConditions });
    }
  }

  const where: Prisma.SubjectWhereInput =
    andConditions.length > 0 ? { AND: andConditions } : {};


  const pagination = paginationHelper.calculatePagination({
    page,
    limit,
    sortBy,
    sortOrder,
  });


  const orderBy: Prisma.SubjectOrderByWithRelationInput = {
    [pagination.sortBy]: pagination.sortOrder,
  };

 
  if (!subjectSortableFields.includes(pagination.sortBy as any)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid sortBy field');
  }


  const [subjects, total] = await Promise.all([
    prisma.subject.findMany({
      where,
      skip: pagination.skip,
      take: pagination.limit,
      orderBy,
    }),
    prisma.subject.count({ where }),
  ]);

  const totalPages = Math.ceil(total / pagination.limit);

  return {
    meta: {
      page: pagination.page,
      limit: pagination.limit,
      total,
      totalPages,
      hasNext: pagination.page < totalPages,
      hasPrev: pagination.page > 1,
    },
    data: subjects,
  };
};

const getSingleSubject = async (id: number) => {
  const result = await prisma.subject.findUnique({
    where: { id },
    include: { subjectGroups: true },
  });

  if (!result) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Subject not found');
  }

  return result;
};

const updateSubject = async (id: number, payload: TSubjectUpdate) => {
  const subject = await prisma.subject.findUnique({ where: { id } });

  if (!subject) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Subject not found');
  }

  // Optional: prevent code duplication on update
  if (payload.code && payload.code !== subject.code) {
    const duplicate = await prisma.subject.findUnique({
      where: { code: payload.code },
    });
    if (duplicate) {
      throw new ApiError(httpStatus.CONFLICT, 'Subject code already in use');
    }
  }

  const result = await prisma.subject.update({
    where: { id },
    data: payload,
  });

  return result;
};

const deleteSubject = async (id: number) => {
  const subject = await prisma.subject.findUnique({ where: { id } });

  if (!subject) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Subject not found');
  }


  const hasGroups = await prisma.subjectGroup.count({
    where: { subjectId: id },
  });

  if (hasGroups > 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Cannot delete subject with associated groups');
  }

  await prisma.subject.delete({ where: { id } });

  return { message: 'Subject deleted successfully' };
};

export const subjectService = {
  createSubject,
  getAllSubjects,
  getSingleSubject,
  updateSubject,
  deleteSubject,
};