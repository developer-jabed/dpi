import { Teacher } from '@prisma/client';
import { paginationHelper } from '../../helper/paginationHelper';
import { prisma } from '../../shared/prisma';

const getAllTeachers = async (params: any, options: any) => {
  const { page, limit, skip, sortBy, sortOrder } =
    paginationHelper.calculatePagination(options);

  const { searchTerm, ...filterData } = params;

  const andConditions: any[] = [];

  // 🔍 Search
  if (searchTerm) {
    andConditions.push({
      OR: ['name', 'email', 'mobile', 'designation'].map(field => ({
        [field]: {
          contains: searchTerm,
          mode: 'insensitive',
        },
      })),
    });
  }

  // 🎯 Exact filters
  if (Object.keys(filterData).length > 0) {
    andConditions.push({
      AND: Object.entries(filterData).map(([key, value]) => ({
        [key]: {
          equals: value,
        },
      })),
    });
  }

  // ❌ Exclude deleted
  andConditions.push({
    isDeleted: false,
  });

  const whereConditions =
    andConditions.length > 0 ? { AND: andConditions } : {};

  const [result, total] = await Promise.all([
    prisma.teacher.findMany({
      where: whereConditions,
      skip,
      take: limit,
      orderBy: {
        [sortBy]: sortOrder,
      },
      include: {
        department: true,
        user: true,
      },
    }),
    prisma.teacher.count({
      where: whereConditions,
    }),
  ]);

  return {
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    data: result,
  };
};

const getSingleTeacher = async (id: number): Promise<Teacher | null> => {
  return prisma.teacher.findUnique({
    where: { id },
    include: {
      department: true,
      user: true,
      subjectGroups: true,
      attendanceSessions: true,
    },
  });
};

export const teacherService = {
  getAllTeachers,
  getSingleTeacher,
};