import { prisma } from '../../shared/prisma';
import { Prisma } from '@prisma/client';
import ApiError from '../../errors/api.error';
import httpStatus from 'http-status';
import { paginationHelper } from '../../helper/paginationHelper';
import {
  subjectSearchableFields,
  subjectSortableFields,
} from './subject.constant';
import {
  ISubjectFilterRequest,
  TSubjectCreate,
  TSubjectUpdate,
} from './subject.interface';

const subjectInclude = {
  semester: true,
  department: true,
} satisfies Prisma.SubjectInclude;

const findOrThrow = async (id: number) => {
  const record = await prisma.subject.findUnique({ where: { id } });
  if (!record) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Subject not found');
  }
  return record;
};

// ── Create ────────────────────────────────────────────────────────────────────
const createSubject = async (payload: TSubjectCreate) => {
  const existing = await prisma.subject.findUnique({
    where: { code: payload.code },
  });

  if (existing) {
    throw new ApiError(httpStatus.CONFLICT, 'Subject code already exists');
  }

  return prisma.subject.create({
    data: {
      name: payload.name,
      shortName: payload.shortName,
      code: payload.code,
      credits: payload.credits,
      semesterId: payload.semesterId,
      departmentId: payload.departmentId,
      totalClasses: payload.totalClasses ?? 0,
    },
    include: subjectInclude,
  });
};
const getAllSubjects = async (filters: ISubjectFilterRequest) => {
  const {
    searchTerm,
    page,
    limit,
    sortBy,
    sortOrder,
    semesterId,
    departmentId,
    ...rest
  } = filters;

  const andConditions: Prisma.SubjectWhereInput[] = [
    { isDeleted: false },
  ];

  // Search
  if (searchTerm?.trim()) {
    andConditions.push({
      OR: subjectSearchableFields.map((field) => ({
        [field]: { contains: searchTerm.trim(), mode: 'insensitive' },
      })),
    });
  }

  // Semester filter — number only
  if (semesterId !== undefined && semesterId !== null) {
    andConditions.push({
      semesterId: Number(semesterId),
    });
  }

  // Department filter — number only
  if (departmentId !== undefined && departmentId !== null) {
    andConditions.push({
      departmentId: Number(departmentId),
    });
  }

  // Extra filters (skip null / undefined only)
  if (Object.keys(rest).length > 0) {
    const extra = Object.entries(rest)
      .filter(([_, value]) => value !== undefined && value !== null)
      .map(([field, value]) => ({ [field]: value }));

    if (extra.length > 0) {
      andConditions.push({ AND: extra });
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
      page: pagination.page,
      limit: pagination.limit,
      total,
      totalPages,
      hasNext: pagination.page < totalPages,
      hasPrev: pagination.page > 1,
    },
    data,
  };
};

// ── Semester-wise book list (grouped) ─────────────────────────────────────────
/**
 * Returns all subjects grouped by semester.
 * Optional filters: departmentId, searchTerm
 *
 * Example response:
 * [
 *   {
 *     semester: { id: 1, name: "1st", order: 1 },
 *     books: [ { id, name, code, credits, ... }, ... ]
 *   },
 *   ...
 * ]
 */// ── Semester-wise book list (grouped) ─────────────────────────────────────────
const getSubjectsGroupedBySemester = async (filters?: {
  departmentId?: number | string;
  searchTerm?: string;
}) => {
  const andConditions: Prisma.SubjectWhereInput[] = [{ isDeleted: false }];

  // Safe check for number | string
  if (
    filters?.departmentId !== undefined &&
    filters.departmentId !== null &&
    String(filters.departmentId).trim() !== ''
  ) {
    andConditions.push({
      departmentId: Number(filters.departmentId),
    });
  }

  if (filters?.searchTerm?.trim()) {
    andConditions.push({
      OR: subjectSearchableFields.map((field) => ({
        [field]: {
          contains: filters.searchTerm!.trim(),
          mode: 'insensitive' as const,
        },
      })),
    });
  }

  const where: Prisma.SubjectWhereInput =
    andConditions.length > 0 ? { AND: andConditions } : {};

  const subjects = await prisma.subject.findMany({
    where,
    include: subjectInclude,
    orderBy: [{ semester: { order: 'asc' } }, { code: 'asc' }],
  });

  const map = new Map<
    number,
    {
      semester: { id: number; name: string; order: number };
      books: typeof subjects;
    }
  >();

  for (const subject of subjects) {
    const sem = subject.semester;
    if (!sem) continue;

    if (!map.has(sem.id)) {
      map.set(sem.id, {
        semester: { id: sem.id, name: sem.name, order: sem.order },
        books: [],
      });
    }
    map.get(sem.id)!.books.push(subject);
  }

  return Array.from(map.values()).sort(
    (a, b) => a.semester.order - b.semester.order
  );
};

// ── Books of a single semester ────────────────────────────────────────────────
const getSubjectsBySemester = async (
  semesterId: number,
  filters?: { departmentId?: number | string; searchTerm?: string }
) => {
  const semester = await prisma.semester.findUnique({
    where: { id: semesterId },
  });

  if (!semester) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Semester not found');
  }

  const andConditions: Prisma.SubjectWhereInput[] = [
    { isDeleted: false },
    { semesterId },
  ];

  if (
    filters?.departmentId !== undefined &&
    filters.departmentId !== null &&
    String(filters.departmentId).trim() !== ''
  ) {
    andConditions.push({
      departmentId: Number(filters.departmentId),
    });
  }

  if (filters?.searchTerm?.trim()) {
    andConditions.push({
      OR: subjectSearchableFields.map((field) => ({
        [field]: {
          contains: filters.searchTerm!.trim(),
          mode: 'insensitive' as const,
        },
      })),
    });
  }

  const books = await prisma.subject.findMany({
    where: { AND: andConditions },
    include: subjectInclude,
    orderBy: { code: 'asc' },
  });

  return {
    semester: {
      id: semester.id,
      name: semester.name,
      order: semester.order,
    },
    totalBooks: books.length,
    books,
  };
};
// ── Single / Update ───────────────────────────────────────────────────────────
const getSingleSubject = async (id: number) => {
  const result = await prisma.subject.findUnique({
    where: { id },
    include: {
      ...subjectInclude,
      subjectGroups: true,
    },
  });

  if (!result) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Subject not found');
  }

  return result;
};

const updateSubject = async (id: number, payload: TSubjectUpdate) => {
  const subject = await findOrThrow(id);

  if (payload.code && payload.code !== subject.code) {
    const duplicate = await prisma.subject.findUnique({
      where: { code: payload.code },
    });
    if (duplicate) {
      throw new ApiError(httpStatus.CONFLICT, 'Subject code already in use');
    }
  }

  return prisma.subject.update({
    where: { id },
    data: {
      name: payload.name,
      shortName: payload.shortName,
      code: payload.code,
      credits: payload.credits,
      semesterId: payload.semesterId,
      departmentId: payload.departmentId,
      totalClasses: payload.totalClasses,
    },
    include: subjectInclude,
  });
};

export const subjectService = {
  createSubject,
  getAllSubjects,
  getSubjectsGroupedBySemester, // semester-wise book list
  getSubjectsBySemester,        // books of one semester
  getSingleSubject,
  updateSubject,
};