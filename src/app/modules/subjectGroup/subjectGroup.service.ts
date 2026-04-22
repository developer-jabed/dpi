import { prisma } from '../../shared/prisma';
import ApiError from '../../errors/api.error';
import httpStatus from 'http-status';
import { paginationHelper } from '../../helper/paginationHelper';
import { Prisma } from '@prisma/client';
import { ISubjectGroupFilterRequest, TSubjectGroupCreate, TSubjectGroupUpdate } from './subjectGroup.interface';
import { subjectGroupSearchableFields, subjectGroupSortableFields } from './subjectGroup.constant';

export const subjectGroupService = {
  createSubjectGroup: async (payload: TSubjectGroupCreate) => {

    const existing = await prisma.subjectGroup.findFirst({
      where: { subjectId: payload.subjectId, groupId: payload.groupId },
    });

    if (existing) {
      throw new ApiError(httpStatus.CONFLICT, 'This subject is already assigned to the group');
    }

    return prisma.subjectGroup.create({
      data: payload,
      include: {
        subject: true,
        group: true,
        teacher: true,
        attendanceSessions: true,
      },
    });
  },

  getSingleSubjectGroup: async (id: number) => {
    const subjectGroup = await prisma.subjectGroup.findUnique({
      where: { id },
      include: {
        subject: true,
        group: true,
        teacher: true,
        attendanceSessions: true,
      },
    });

    if (!subjectGroup) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Subject group not found');
    }

    return subjectGroup;
  },

  // getAllSubjectGroups: async (filters: ISubjectGroupFilterRequest) => {
  //   const { searchTerm, page = 1, limit = 10, sortBy, sortOrder } = filters;

  //   const where: Prisma.SubjectGroupWhereInput = searchTerm
  //     ? {
  //         OR: subjectGroupSearchableFields.map(field => ({
  //           [field]: { contains: searchTerm, mode: 'insensitive' },
  //         })),
  //       }
  //     : {};

  //   const orderBy: any = sortBy && subjectGroupSortableFields.includes(sortBy)
  //     ? { [sortBy]: sortOrder || 'asc' }
  //     : { id: 'desc' };

  //   const skip = (page - 1) * limit;

  //   const [data, total] = await Promise.all([
  //     prisma.subjectGroup.findMany({
  //       where,
  //       include: {
  //         subject: true,
  //         group: true,
  //         teacher: true,
  //         attendanceSessions: true,
  //       },
  //       orderBy,
  //       skip,
  //       take: limit,
  //     }),
  //     prisma.subjectGroup.count({ where }),
  //   ]);

  //   return paginationHelper(data, total, page, limit);
  // },





  getLoginTeacherSubjectGroups: async (teacherId: number) => {
    return prisma.subjectGroup.findMany({
      where: { teacherId },
      include: {
        subject: true,
        group: true,
        teacher: true,
        attendanceSessions: true,
      },
    });
  },

  updateSubjectGroup: async (id: number, payload: TSubjectGroupUpdate) => {
    // Optional: check unique combination if updating subjectId/groupId
    if (payload.subjectId || payload.groupId) {
      const existing = await prisma.subjectGroup.findFirst({
        where: {
          subjectId: payload.subjectId,
          groupId: payload.groupId,
          NOT: { id },
        },
      });
      if (existing) {
        throw new ApiError(httpStatus.CONFLICT, 'This subject is already assigned to the group');
      }
    }

    return prisma.subjectGroup.update({
      where: { id },
      data: payload,
      include: {
        subject: true,
        group: true,
        teacher: true,
        attendanceSessions: true,
      },
    });
  },

  deleteSubjectGroup: async (id: number) => {
    const existing = await prisma.subjectGroup.findUnique({ where: { id } });
    if (!existing) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Subject group not found');
    }

    return prisma.subjectGroup.delete({ where: { id } });
  },
};