import { DiplomaResultStatus, Prisma, SubjectResultType } from '@prisma/client';
import httpStatus from 'http-status';
import ApiError from '../../errors/api.error';
import { paginationHelper } from '../../helper/paginationHelper';
import { prisma } from '../../shared/prisma';
import { redis } from '../../shared/redis';

// ────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────
const DPI_INSTITUTE_CODE = '13085';
const CACHE_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
const CACHE_PREFIX = 'dpi:result:';

// ────────────────────────────────────────────────
// Redis Cache Helpers (optimized for Upstash)
// ────────────────────────────────────────────────
const getCache = async <T>(key: string): Promise<T | null> => {
  try {
    const cached = await redis.get(key);
    if (!cached) return null;
    return JSON.parse(cached) as T;
  } catch (err) {
    console.error(`[Cache] GET ${key}:`, (err as Error).message);
    return null;
  }
};

const setCache = async (key: string, data: any, ttl = CACHE_TTL_SECONDS) => {
  try {
    await redis.set(key, JSON.stringify(data), 'EX', ttl);
  } catch (err) {
    console.error(`[Cache] SET ${key}:`, (err as Error).message);
  }
};

/** Invalidate one or many rolls (uses pipeline) */
export const invalidateResultCache = async (roll?: string | string[]) => {
  try {
    if (!roll) return;

    const rolls = Array.isArray(roll) ? roll : [roll];
    if (!rolls.length) return;

    const pipeline = redis.pipeline();
    for (const r of rolls) {
      pipeline.del(`${CACHE_PREFIX}${r.trim()}`);
    }
    await pipeline.exec();
    console.info(`[Cache] Invalidated ${rolls.length} key(s)`);
  } catch (err) {
    console.error('[Cache] invalidate error:', (err as Error).message);
  }
};

/** Warm many rolls with a single pipeline */
const warmResultCache = async (
  items: Array<{ roll: string; data: unknown }>,
) => {
  if (!items.length) return;

  try {
    const pipeline = redis.pipeline();
    for (const { roll, data } of items) {
      pipeline.set(
        `${CACHE_PREFIX}${roll.trim()}`,
        JSON.stringify(data),
        'EX',
        CACHE_TTL_SECONDS,
      );
    }
    await pipeline.exec();
    console.info(`[Cache] Warmed ${items.length} rolls`);
  } catch (err) {
    console.error('[Cache] warm error:', (err as Error).message);
  }
};

// ────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────
interface GetAllQuery {
  filters: {
    searchTerm?: string;
    status?: DiplomaResultStatus;
    semesterName?: string;
    examYear?: number | string;
    regulation?: string;
    instituteCode?: string;
    subjectCode?: string;
  };
  paginationOptions: {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  };
}

// ────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────
const SORTABLE_FIELDS = new Set([
  'roll',
  'semesterName',
  'examYear',
  'status',
  'gpa3',
  'createdAt',
]);

const SUBJECT_BREAKDOWN_INCLUDE = {
  select: {
    type: true,
    subjectCode: true,
    subject: {
      select: {
        code: true,
        name: true,
        shortName: true,
        semester: { select: { id: true, name: true, order: true } },
      },
    },
  },
} as const;

function formatSubjectBreakdown(
  rows: Array<{
    type: SubjectResultType;
    subjectCode: string;
    subject: {
      code: string;
      name: string;
      shortName: string;
      semester: { id: number; name: string; order: number } | null;
    } | null;
  }>,
) {
  return rows.map((row) => ({
    code: row.subject?.code ?? row.subjectCode,
    name: row.subject?.name ?? 'Unknown subject',
    shortName: row.subject?.shortName ?? null,
    semesterName: row.subject?.semester?.name ?? null,
    semesterOrder: row.subject?.semester?.order ?? null,
    type: row.type,
  }));
}

// ────────────────────────────────────────────────
// GET RESULT BY ROLL (Redis first – super fast)
// ────────────────────────────────────────────────
const getResultByRoll = async (roll: string) => {
  const cleanRoll = roll.trim();
  const cacheKey = `${CACHE_PREFIX}${cleanRoll}`;

  // 1. Redis hit
  const cached = await getCache(cacheKey);
  if (cached) return cached;

  // 2. DB
  const results = await prisma.diplomaResult.findMany({
    where: {
      roll: cleanRoll,
      isDeleted: false,
      instituteCode: DPI_INSTITUTE_CODE,
    },
    orderBy: [{ examYear: 'desc' }, { semesterId: 'desc' }],
    select: {
      id: true,
      roll: true,
      examYear: true,
      regulation: true,
      status: true,
      semesterName: true,
      instituteName: true,
      instituteCode: true,
      gpa1: true,
      gpa2: true,
      gpa3: true,
      gpa4: true,
      gpa5: true,
      gpa6: true,
      gpa7: true,
      referredSubjects: true,
      failedSubjects: true,
      createdAt: true,
      updatedAt: true,
      student: {
        select: {
          id: true,
          name: true,
          roll: true,
          registration: true,
          profilePhoto: true,
        },
      },
      semester: { select: { id: true, name: true, order: true } },
      group: { select: { id: true, name: true, session: true } },
      subjectBreakdown: {
        ...SUBJECT_BREAKDOWN_INCLUDE,
        orderBy: { subjectCode: 'asc' },
      },
    },
  });

  if (!results.length) {
    throw new ApiError(
      httpStatus.NOT_FOUND,
      `No result found for roll: ${cleanRoll}`,
    );
  }

  const formatted = results.map((r) => ({
    ...r,
    subjectBreakdown: formatSubjectBreakdown(r.subjectBreakdown),
  }));

  // 3. Cache for next requests (non-blocking)
  setCache(cacheKey, formatted).catch(() => {});

  return formatted;
};

// ────────────────────────────────────────────────
// GET SINGLE RESULT (by composite key)
// ────────────────────────────────────────────────
const getResultByRollAndSemester = async (
  roll: string,
  semesterName: string,
  examYear: number,
  regulation: string,
) => {
  const result = await prisma.diplomaResult.findUnique({
    where: {
      roll_semesterName_examYear_regulation: {
        roll: roll.trim(),
        semesterName,
        examYear,
        regulation,
      },
    },
    select: {
      id: true,
      roll: true,
      examYear: true,
      regulation: true,
      status: true,
      semesterName: true,
      instituteName: true,
      instituteCode: true,
      gpa1: true,
      gpa2: true,
      gpa3: true,
      gpa4: true,
      gpa5: true,
      gpa6: true,
      gpa7: true,
      referredSubjects: true,
      failedSubjects: true,
      student: {
        select: {
          id: true,
          name: true,
          roll: true,
          registration: true,
          profilePhoto: true,
        },
      },
      semester: { select: { id: true, name: true, order: true } },
      group: { select: { id: true, name: true, session: true } },
      subjectBreakdown: SUBJECT_BREAKDOWN_INCLUDE,
    },
  });

  if (!result || result.instituteCode !== DPI_INSTITUTE_CODE) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Result not found');
  }

  return {
    ...result,
    subjectBreakdown: formatSubjectBreakdown(result.subjectBreakdown),
  };
};

// ────────────────────────────────────────────────
// GET ALL RESULTS
// ────────────────────────────────────────────────
const getAllResults = async ({ filters, paginationOptions }: GetAllQuery) => {
  const { page, limit, skip, sortBy, sortOrder } =
    paginationHelper.calculatePagination(paginationOptions);

  const { searchTerm, examYear, subjectCode, ...filterData } = filters;

  const andConditions: Prisma.DiplomaResultWhereInput[] = [
    { isDeleted: false },
    { instituteCode: DPI_INSTITUTE_CODE },
  ];

  if (searchTerm) {
    andConditions.push({
      OR: [
        { roll: { contains: searchTerm, mode: 'insensitive' } },
        { instituteName: { contains: searchTerm, mode: 'insensitive' } },
      ],
    });
  }

  if (examYear !== undefined && examYear !== '') {
    const year = Number(examYear);
    if (!isNaN(year)) {
      andConditions.push({ examYear: year });
    }
  }

  if (subjectCode) {
    andConditions.push({
      subjectBreakdown: { some: { subjectCode } },
    });
  }

  const exactFields = ['status', 'semesterName', 'regulation'] as const;
  for (const field of exactFields) {
    const val = filterData[field as keyof typeof filterData];
    if (val !== undefined && val !== '') {
      andConditions.push({ [field]: val });
    }
  }

  const where: Prisma.DiplomaResultWhereInput = { AND: andConditions };
  const safeSortBy = SORTABLE_FIELDS.has(sortBy ?? '') ? sortBy! : 'createdAt';

  const [data, total] = await prisma.$transaction([
    prisma.diplomaResult.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [safeSortBy]: sortOrder ?? 'desc' },
      select: {
        id: true,
        roll: true,
        examYear: true,
        regulation: true,
        status: true,
        semesterName: true,
        instituteName: true,
        instituteCode: true,
        gpa1: true,
        gpa2: true,
        gpa3: true,
        gpa4: true,
        gpa5: true,
        gpa6: true,
        gpa7: true,
        referredSubjects: true,
        failedSubjects: true,
        createdAt: true,
        student: {
          select: { id: true, name: true, roll: true, profilePhoto: true },
        },
        semester: { select: { id: true, name: true, order: true } },
        group: { select: { id: true, name: true, session: true } },
        subjectBreakdown: SUBJECT_BREAKDOWN_INCLUDE,
      },
    }),
    prisma.diplomaResult.count({ where }),
  ]);

  return {
    meta: { page, limit, total },
    data: data.map((r) => ({
      ...r,
      subjectBreakdown: formatSubjectBreakdown(r.subjectBreakdown),
    })),
  };
};

// ────────────────────────────────────────────────
// SUBJECT-WISE REPORT
// ────────────────────────────────────────────────
const getSubjectWiseReport = async (
  params: {
    type?: SubjectResultType;
    semesterName?: string;
    examYear?: number;
  } = {},
) => {
  const { type, semesterName, examYear } = params;

  const grouped = await prisma.diplomaResultSubject.groupBy({
    by: ['subjectId', 'subjectCode', 'type'],
    where: {
      ...(type ? { type } : {}),
      diplomaResult: {
        isDeleted: false,
        instituteCode: DPI_INSTITUTE_CODE,
        ...(semesterName ? { semesterName } : {}),
        ...(examYear !== undefined ? { examYear } : {}),
      },
    },
    _count: { _all: true },
    orderBy: { _count: { subjectId: 'desc' } },
  });

  const subjectIds = grouped
    .map((g) => g.subjectId)
    .filter((id): id is number => id !== null);

  const subjects = subjectIds.length
    ? await prisma.subject.findMany({
        where: { id: { in: subjectIds } },
        select: {
          id: true,
          code: true,
          name: true,
          semester: { select: { name: true, order: true } },
        },
      })
    : [];

  const subjectMap = new Map(subjects.map((s) => [s.id, s]));

  return grouped.map((g) => {
    const subject =
      g.subjectId !== null ? subjectMap.get(g.subjectId) : undefined;
    return {
      code: subject?.code ?? g.subjectCode,
      name: subject?.name ?? 'Unknown subject',
      semesterName: subject?.semester?.name ?? null,
      type: g.type,
      studentCount: g._count._all,
    };
  });
};

// ────────────────────────────────────────────────
// Exports
// ────────────────────────────────────────────────
export const resultQueryService = {
  getResultByRoll,
  getResultByRollAndSemester,
  getAllResults,
  getSubjectWiseReport,
  invalidateResultCache,
};