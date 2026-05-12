import { Prisma } from "@prisma/client";
import httpStatus from "http-status";

import { prisma } from "../../shared/prisma";
import ApiError from "../../errors/api.error";
import { paginationHelper } from "../../helper/paginationHelper";

import {
  noticeSearchableFields,
} from "./notice.constant";

import {
  INoticeFilterRequest,
  TNoticeCreate,
  TNoticeUpdate,
} from "./notice.interface";

const createNotice = async (payload: TNoticeCreate) => {
  const result = await prisma.notice.create({
    data: payload,
    include: {
      department: true,
      semester: true,
      group: true,
      student: true,
      createdBy: true,
    },
  });

  return result;
};

const getAllNotices = async (
  filters: INoticeFilterRequest,
  options: any
) => {
  const { limit, page, skip, sortBy, sortOrder } =
    paginationHelper.calculatePagination(options);

  const { searchTerm, ...filterData } = filters;

  const andConditions: Prisma.NoticeWhereInput[] = [];

  if (searchTerm) {
    andConditions.push({
      OR: noticeSearchableFields.map((field) => ({
        [field]: {
          contains: searchTerm,
          mode: "insensitive",
        },
      })),
    });
  }

  if (Object.keys(filterData).length > 0) {
    andConditions.push({
      AND: Object.entries(filterData).map(([field, value]) => ({
        [field]: value,
      })),
    });
  }

  const whereConditions: Prisma.NoticeWhereInput =
    andConditions.length > 0 ? { AND: andConditions } : {};

  const result = await prisma.notice.findMany({
    where: whereConditions,
    skip,
    take: limit,
    orderBy:
      sortBy && sortOrder
        ? {
            [sortBy]: sortOrder,
          }
        : {
            createdAt: "desc",
          },

    include: {
      department: true,
      semester: true,
      group: true,
      student: true,
      createdBy: true,
    },
  });

  const total = await prisma.notice.count({
    where: whereConditions,
  });

  return {
    meta: {
      total,
      page,
      limit,
    },
    data: result,
  };
};

const getSingleNotice = async (id: number) => {
  const result = await prisma.notice.findUnique({
    where: {
      id,
    },

    include: {
      department: true,
      semester: true,
      group: true,
      student: true,
      createdBy: true,
    },
  });

  if (!result) {
    throw new ApiError(
      httpStatus.NOT_FOUND,
      "Notice not found"
    );
  }

  return result;
};

const updateNotice = async (
  id: number,
  payload: TNoticeUpdate
) => {
  const isExist = await prisma.notice.findUnique({
    where: {
      id,
    },
  });

  if (!isExist) {
    throw new ApiError(
      httpStatus.NOT_FOUND,
      "Notice not found"
    );
  }

  const result = await prisma.notice.update({
    where: {
      id,
    },
    data: payload,
  });

  return result;
};

const deleteNotice = async (id: number) => {
  const isExist = await prisma.notice.findUnique({
    where: {
      id,
    },
  });

  if (!isExist) {
    throw new ApiError(
      httpStatus.NOT_FOUND,
      "Notice not found"
    );
  }

  const result = await prisma.notice.delete({
    where: {
      id,
    },
  });

  return result;
};

export const noticeService = {
  createNotice,
  getAllNotices,
  getSingleNotice,
  updateNotice,
  deleteNotice,
};