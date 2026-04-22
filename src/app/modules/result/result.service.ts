import { DiplomaResultStatus, Prisma } from '@prisma/client';
import httpStatus from 'http-status';
import ApiError from '../../errors/api.error';
import { paginationHelper } from '../../helper/paginationHelper';
import { prisma } from '../../shared/prisma';

interface GetAllQuery {
  filters: {
    searchTerm?:   string;
    status?:       DiplomaResultStatus;
    semesterName?: string;
    examYear?:     number | string;
    regulation?:   string;
    instituteCode?:string;
  };
  paginationOptions: {
    page?:      number;
    limit?:     number;
    sortBy?:    string;
    sortOrder?: 'asc' | 'desc';
  };
}

// ─── Allowed sort columns (whitelist against injection) ───────────────────────
const SORTABLE_FIELDS = new Set([
  'roll', 'semesterName', 'examYear', 'status', 'gpa3', 'createdAt',
]);

// ─── GET ALL RESULTS FOR A ROLL (one student, possibly many semesters) ────────
const getResultByRoll = async (roll: string) => {
  const results = await prisma.diplomaResult.findMany({
    where:   { roll, isDeleted: false },
    orderBy: { examYear: 'desc' },
    include: {
      student:  { select: { id: true, name: true, roll: true, registration: true } },
      semester: { select: { id: true, name: true, order: true } },
      group:    { select: { id: true, name: true, session: true } },
    },
  });

  if (!results.length) {
    throw new ApiError(httpStatus.NOT_FOUND, `No result found for roll: ${roll}`);
  }

  return results;
};

// ─── GET SINGLE RESULT BY ROLL + SEMESTER + YEAR + REGULATION ─────────────────
const getResultByRollAndSemester = async (
  roll:        string,
  semesterName:string,
  examYear:    number,
  regulation:  string,
) => {
  const result = await prisma.diplomaResult.findUnique({
    where: {
      roll_semesterName_examYear_regulation: {
        roll,
        semesterName,
        examYear,
        regulation,
      },
    },
    include: {
      student:  { select: { id: true, name: true, roll: true, registration: true } },
      semester: { select: { id: true, name: true, order: true } },
      group:    { select: { id: true, name: true, session: true } },
    },
  });

  if (!result) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Result not found');
  }

  return result;
};

// ─── GET ALL RESULTS (paginated + filtered) ───────────────────────────────────
const getAllResults = async ({ filters, paginationOptions }: GetAllQuery) => {
  const { page, limit, skip, sortBy, sortOrder } =
    paginationHelper.calculatePagination(paginationOptions);

  const { searchTerm, examYear, ...filterData } = filters;

  const andConditions: Prisma.DiplomaResultWhereInput[] = [
    { isDeleted: false },
  ];

  // ── Full-text search across roll and institute name ────────────────────────
  if (searchTerm) {
    andConditions.push({
      OR: [
        { roll:          { contains: searchTerm, mode: 'insensitive' } },
        { instituteName: { contains: searchTerm, mode: 'insensitive' } },
      ],
    });
  }

  // ── examYear: coerce string → number ──────────────────────────────────────
  if (examYear !== undefined && examYear !== '') {
    const year = Number(examYear);
    if (!isNaN(year)) {
      andConditions.push({ examYear: year });
    }
  }

  // ── Exact-match filters (status, semesterName, regulation, instituteCode) ──
  const exactFields = ['status', 'semesterName', 'regulation', 'instituteCode'] as const;
  for (const field of exactFields) {
    const val = filterData[field as keyof typeof filterData];
    if (val !== undefined && val !== '') {
      andConditions.push({ [field]: val });
    }
  }

  const where: Prisma.DiplomaResultWhereInput = { AND: andConditions };

  // ── Safe sort field (whitelist prevents injection) ─────────────────────────
  const safeSortBy = SORTABLE_FIELDS.has(sortBy ?? '') ? sortBy! : 'createdAt';

  const [data, total] = await prisma.$transaction([
    prisma.diplomaResult.findMany({
      where,
      skip,
      take:    limit,
      orderBy: { [safeSortBy]: sortOrder ?? 'desc' },
      include: {
        student:  { select: { id: true, name: true, roll: true } },
        semester: { select: { id: true, name: true, order: true } },
        group:    { select: { id: true, name: true, session: true } },
      },
    }),
    prisma.diplomaResult.count({ where }),
  ]);

  return {
    meta: { page, limit, total },
    data,
  };
};

// ─── Exports ──────────────────────────────────────────────────────────────────

export const resultQueryService = {
  getResultByRoll,
  getResultByRollAndSemester,
  getAllResults,
};