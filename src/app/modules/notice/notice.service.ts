import { NoticePriority, Prisma } from "@prisma/client";
import httpStatus from "http-status";

import { prisma } from "../../shared/prisma";
import ApiError from "../../errors/api.error";
import { paginationHelper } from "../../helper/paginationHelper";
import { noticeSearchableFields } from "./notice.constant";
import {
  INoticeFilterRequest,
  IViewerContext,
  TNoticeCreate,
  TNoticeUpdate,
} from "./notice.interface";

// ─────────────────────────────────────────────────────────────
// Shared include
// ─────────────────────────────────────────────────────────────

const noticeInclude = {
  department: true,
  semester: true,
  group: true,
  student: true,
  teacher: true,
  createdBy: true,
} satisfies Prisma.NoticeInclude;

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

const NUMERIC_FILTER_FIELDS = [
  "departmentId",
  "semesterId",
  "groupId",
  "studentId",
  "teacherId",
  "createdById",
] as const;

const toBoolean = (
  value: boolean | string | undefined,
): boolean | undefined => {
  if (value === undefined) return undefined;
  if (typeof value === "boolean") return value;
  return value === "true";
};

const coerceFilterData = (
  filterData: Record<string, any>,
): Record<string, any> => {
  const coerced: Record<string, any> = {};

  for (const [key, value] of Object.entries(filterData)) {
    if (NUMERIC_FILTER_FIELDS.includes(key as any)) {
      const num = Number(value);
      coerced[key] = isNaN(num) ? undefined : num;
    } else {
      coerced[key] = value;
    }
  }

  return Object.fromEntries(
    Object.entries(coerced).filter(([, v]) => v !== undefined),
  );
};

const buildViewerConditions = (
  ctx: IViewerContext,
): Prisma.NoticeWhereInput[] => {
  if (ctx.role === "student") {
    return [
      {
        OR: [
          { audienceType: "ALL" },
          { audienceType: "STUDENT", studentId: ctx.studentId },
          ...(ctx.groupId
            ? [{ audienceType: "GROUP" as const, groupId: ctx.groupId }]
            : []),
          ...(ctx.semesterId
            ? [
                {
                  audienceType: "SEMESTER" as const,
                  semesterId: ctx.semesterId,
                },
              ]
            : []),
          ...(ctx.departmentId
            ? [
                {
                  audienceType: "DEPARTMENT" as const,
                  departmentId: ctx.departmentId,
                },
              ]
            : []),
        ],
      },
      { isPublished: true },
    ];
  }

  if (ctx.role === "teacher") {
    return [
      {
        OR: [
          { audienceType: "ALL" },
          { audienceType: "TEACHER", teacherId: ctx.teacherId },
          ...(ctx.departmentId
            ? [
                {
                  audienceType: "DEPARTMENT" as const,
                  departmentId: ctx.departmentId,
                },
              ]
            : []),
        ],
      },
      { isPublished: true },
    ];
  }

  if (ctx.role === "group") {
    return [
      {
        OR: [
          { audienceType: "ALL" },
          { audienceType: "GROUP", groupId: ctx.groupId },
          ...(ctx.semesterId
            ? [
                {
                  audienceType: "SEMESTER" as const,
                  semesterId: ctx.semesterId,
                },
              ]
            : []),
          ...(ctx.departmentId
            ? [
                {
                  audienceType: "DEPARTMENT" as const,
                  departmentId: ctx.departmentId,
                },
              ]
            : []),
        ],
      },
      { isPublished: true },
    ];
  }

  return [];
};

// ─────────────────────────────────────────────────────────────
// Create Notice
// ─────────────────────────────────────────────────────────────

const createNotice = async (payload: TNoticeCreate) => {
  const result = await prisma.notice.create({
    data: {
      ...payload,
      noticeDate: payload.noticeDate ? new Date(payload.noticeDate) : undefined,
      expiryDate: payload.expiryDate ? new Date(payload.expiryDate) : undefined,
    },
    include: noticeInclude,
  });

  return result;
};

// ─────────────────────────────────────────────────────────────
// Get All Notices
// ─────────────────────────────────────────────────────────────

const getAllNotices = async (
  filters: INoticeFilterRequest,
  options: any,
  viewerContext?: IViewerContext,
) => {
  const { limit, page, skip, sortBy, sortOrder } =
    paginationHelper.calculatePagination(options);

  const { searchTerm, isPinned, isPublished, ...rawFilterData } = filters;

  const filterData = coerceFilterData(rawFilterData);

  const andConditions: Prisma.NoticeWhereInput[] = [];

  if (viewerContext) {
    andConditions.push(...buildViewerConditions(viewerContext));
  } else {
    const isPinnedBool = toBoolean(isPinned);
    const isPublishedBool = toBoolean(isPublished);

    if (isPinnedBool !== undefined)
      andConditions.push({ isPinned: isPinnedBool });
    if (isPublishedBool !== undefined)
      andConditions.push({ isPublished: isPublishedBool });

    if (Object.keys(filterData).length > 0) {
      andConditions.push({
        AND: Object.entries(filterData).map(([field, value]) => ({
          [field]: value,
        })),
      });
    }
  }

  if (searchTerm) {
    andConditions.push({
      OR: noticeSearchableFields.map((field) => ({
        [field]: { contains: searchTerm, mode: "insensitive" },
      })),
    });
  }

  if (filters.priority) {
    andConditions.push({ priority: filters.priority as NoticePriority });
  }

  const whereConditions: Prisma.NoticeWhereInput =
    andConditions.length > 0 ? { AND: andConditions } : {};

  const [result, total] = await prisma.$transaction([
    prisma.notice.findMany({
      where: whereConditions,
      skip,
      take: limit,
      orderBy:
        sortBy && sortOrder ? { [sortBy]: sortOrder } : { createdAt: "desc" },
      include: noticeInclude,
    }),
    prisma.notice.count({ where: whereConditions }),
  ]);

  return {
    meta: { total, page, limit },
    data: result,
  };
};

// ─────────────────────────────────────────────────────────────
// Get Single Notice
// ─────────────────────────────────────────────────────────────

const getSingleNotice = async (id: number) => {
  const result = await prisma.notice.findUnique({
    where: { id },
    include: noticeInclude,
  });

  if (!result) {
    throw new ApiError(httpStatus.NOT_FOUND, "Notice not found");
  }

  return result;
};

// ─────────────────────────────────────────────────────────────
// Update Notice
// ─────────────────────────────────────────────────────────────

const updateNotice = async (id: number, payload: TNoticeUpdate) => {
  const isExist = await prisma.notice.findUnique({ where: { id } });

  if (!isExist) {
    throw new ApiError(httpStatus.NOT_FOUND, "Notice not found");
  }

  const result = await prisma.notice.update({
    where: { id },
    data: payload,
    include: noticeInclude,
  });

  return result;
};

// ─────────────────────────────────────────────────────────────
// Delete Notice
// ─────────────────────────────────────────────────────────────

const deleteNotice = async (id: number) => {
  const isExist = await prisma.notice.findUnique({ where: { id } });

  if (!isExist) {
    throw new ApiError(httpStatus.NOT_FOUND, "Notice not found");
  }

  const result = await prisma.notice.delete({
    where: { id },
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
