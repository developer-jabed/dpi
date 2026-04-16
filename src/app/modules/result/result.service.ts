import { Prisma } from '@prisma/client';
import { prisma } from '../../shared/prisma';
import { paginationHelper } from '../../helper/paginationHelper';

interface GetAllQuery {
  filters: any;
  paginationOptions: any;
}

// 🔹 GET SINGLE RESULT BY ROLL
const getResultByRoll = async (roll: string) => {
  const result = await prisma.diplomaResult.findUnique({
    where: { roll },
    include: {
      student: true,
    },
  });

  if (!result) {
    throw new Error('Result not found');
  }

  return result;
};

// 🔹 GET GROUP / BATCH RESULTS
const getAllResults = async ({ filters, paginationOptions }: GetAllQuery) => {
  const { page, limit, skip, sortBy, sortOrder } =
    paginationHelper.calculatePagination(paginationOptions);

  const { searchTerm, ...filterData } = filters;

  const andConditions: Prisma.DiplomaResultWhereInput[] = [];

  // 🔍 Search
  if (searchTerm) {
    andConditions.push({
      OR: [
        {
          roll: {
            contains: searchTerm,
            mode: 'insensitive',
          },
        },
        {
          instituteName: {
            contains: searchTerm,
            mode: 'insensitive',
          },
        },
      ],
    });
  }

  // 🎯 Exact filters
  if (Object.keys(filterData).length > 0) {
    andConditions.push({
      AND: Object.entries(filterData).map(([field, value]) => ({
        [field]: value,
      })),
    });
  }

  const whereConditions: Prisma.DiplomaResultWhereInput =
    andConditions.length > 0 ? { AND: andConditions } : {};

  const result = await prisma.diplomaResult.findMany({
    where: whereConditions,
    skip,
    take: limit,
    orderBy: {
      [sortBy]: sortOrder,
    },
  });

  const total = await prisma.diplomaResult.count({
    where: whereConditions,
  });

  return {
    meta: {
      page,
      limit,
      total,
    },
    data: result,
  };
};

export const resultService = {
  getResultByRoll,
  getAllResults,
};