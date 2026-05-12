import { Practical, PracticalSubmission, Prisma } from "@prisma/client";
import { prisma } from "../../shared/prisma";
import ApiError from "../../errors/api.error";
import httpStatus from "http-status";
import { IPaginationOptions } from "../../interfaces/pagination";
import { paginationHelper } from "../../helper/paginationHelper";
import {
  IBulkCreateSubmissions,
  IBulkUpdateSubmissions,
  ICreatePractical,
  ICreatePracticalSubmission,
  IPracticalFilterRequest,
  IPracticalSubmissionFilterRequest,
  IUpdatePractical,
  IUpdatePracticalSubmission,
} from "./practical.interface";
import { practicalSearchableFields } from "./practical.constant";

// ─── Practical ───────────────────────────────────────────────────────────────

const createPractical = async (
  payload: ICreatePractical,
): Promise<Practical> => {
  const subjectGroup = await prisma.subjectGroup.findFirst({
    where: { id: payload.subjectGroupId, isDeleted: false },
  });

  if (!subjectGroup) {
    throw new ApiError(httpStatus.NOT_FOUND, "SubjectGroup not found");
  }

  const practical = await prisma.practical.create({
    data: {
      subjectGroupId: payload.subjectGroupId,
      title: payload.title,
      totalMarks: payload.totalMarks,
      type: payload.type,
      givenDate: payload.givenDate ? new Date(payload.givenDate) : undefined,
      submissionDeadline: payload.submissionDeadline
        ? new Date(payload.submissionDeadline)
        : undefined,
    },
    include: {
      subjectGroup: {
        include: {
          teacher: true,
          subject: true,
          group: true,
          semester: true,
        },
      },
    },
  });

  return practical;
};

const getAllPracticals = async (
  filters: IPracticalFilterRequest,
  options: IPaginationOptions,
) => {
  const { page, limit, skip, sortBy, sortOrder } =
    paginationHelper.calculatePagination(options);

  const { searchTerm, subjectGroupId, type, title } = filters;

  const andConditions: Prisma.PracticalWhereInput[] = [{ isDeleted: false }];

  if (searchTerm) {
    andConditions.push({
      OR: practicalSearchableFields.map((field) => ({
        [field]: { contains: searchTerm, mode: "insensitive" },
      })),
    });
  }

  if (subjectGroupId) {
    andConditions.push({ subjectGroupId: Number(subjectGroupId) });
  }

  if (type) {
    andConditions.push({ type });
  }

  if (title) {
    andConditions.push({ title: { contains: title, mode: "insensitive" } });
  }

  const whereConditions: Prisma.PracticalWhereInput =
    andConditions.length > 0 ? { AND: andConditions } : {};

  const result = await prisma.practical.findMany({
    where: whereConditions,
    skip,
    take: limit,
    orderBy:
      sortBy && sortOrder ? { [sortBy]: sortOrder } : { createdAt: "desc" },
    include: {
      subjectGroup: {
        include: {
          teacher: true,
          subject: true,
          group: true,
          semester: true,
        },
      },
      submissions: true,
    },
  });

  const total = await prisma.practical.count({ where: whereConditions });

  return {
    meta: { page, limit, total },
    data: result,
  };
};

const getPracticalById = async (id: number): Promise<Practical> => {
  const practical = await prisma.practical.findFirst({
    where: { id, isDeleted: false },
    include: {
      subjectGroup: {
        include: {
          teacher: true,
          subject: true,
          group: true,
          semester: true,
        },
      },
      submissions: {
        include: { student: true },
      },
    },
  });

  if (!practical) {
    throw new ApiError(httpStatus.NOT_FOUND, "Practical not found");
  }

  return practical;
};

const updatePractical = async (
  id: number,
  payload: IUpdatePractical,
): Promise<Practical> => {
  const existing = await prisma.practical.findFirst({
    where: { id, isDeleted: false },
  });

  if (!existing) {
    throw new ApiError(httpStatus.NOT_FOUND, "Practical not found");
  }

  const practical = await prisma.practical.update({
    where: { id },
    data: payload,
    include: {
      subjectGroup: true,
    },
  });

  return practical;
};

const deletePractical = async (id: number): Promise<Practical> => {
  const existing = await prisma.practical.findFirst({
    where: { id, isDeleted: false },
  });

  if (!existing) {
    throw new ApiError(httpStatus.NOT_FOUND, "Practical not found");
  }

  const practical = await prisma.practical.update({
    where: { id },
    data: { isDeleted: true },
  });

  return practical;
};

// ─── Practical Submission ────────────────────────────────────────────────────

const createSubmission = async (
  payload: ICreatePracticalSubmission,
): Promise<PracticalSubmission> => {
  const practical = await prisma.practical.findFirst({
    where: { id: payload.practicalId, isDeleted: false },
  });

  if (!practical) {
    throw new ApiError(httpStatus.NOT_FOUND, "Practical not found");
  }

  const student = await prisma.student.findFirst({
    where: { id: payload.studentId },
  });

  if (!student) {
    throw new ApiError(httpStatus.NOT_FOUND, "Student not found");
  }

  const existing = await prisma.practicalSubmission.findUnique({
    where: {
      practicalId_studentId: {
        practicalId: payload.practicalId,
        studentId: payload.studentId,
      },
    },
  });

  if (existing) {
    throw new ApiError(
      httpStatus.CONFLICT,
      "Submission already exists for this student",
    );
  }

  const submission = await prisma.practicalSubmission.create({
    data: payload,
    include: {
      practical: true,
      student: true,
    },
  });

  return submission;
};

const bulkCreateSubmissions = async (
  payload: IBulkCreateSubmissions,
): Promise<{ count: number }> => {
  const practical = await prisma.practical.findFirst({
    where: { id: payload.practicalId, isDeleted: false },
  });

  if (!practical) {
    throw new ApiError(httpStatus.NOT_FOUND, "Practical not found");
  }

  // Filter out already existing submissions
  const existing = await prisma.practicalSubmission.findMany({
    where: { practicalId: payload.practicalId },
    select: { studentId: true },
  });

  const existingStudentIds = new Set(existing.map((s) => s.studentId));
  const newStudentIds = payload.studentIds.filter(
    (id) => !existingStudentIds.has(id),
  );

  const result = await prisma.practicalSubmission.createMany({
    data: newStudentIds.map((studentId) => ({
      practicalId: payload.practicalId,
      studentId,
      submitted: false,
    })),
  });

  return { count: result.count };
};

const getSubmissionsByPractical = async (
  filters: IPracticalSubmissionFilterRequest,
  options: IPaginationOptions,
) => {
  const { page, limit, skip, sortBy, sortOrder } =
    paginationHelper.calculatePagination(options);

  const { practicalId, studentId, submitted } = filters;

  const andConditions: Prisma.PracticalSubmissionWhereInput[] = [];

  if (practicalId) andConditions.push({ practicalId: Number(practicalId) });
  if (studentId) andConditions.push({ studentId: Number(studentId) });
  if (submitted !== undefined)
    andConditions.push({
      submitted: submitted === true || submitted === ("true" as any),
    });

  const whereConditions: Prisma.PracticalSubmissionWhereInput =
    andConditions.length > 0 ? { AND: andConditions } : {};

  const result = await prisma.practicalSubmission.findMany({
    where: whereConditions,
    skip,
    take: limit,
    orderBy:
      sortBy && sortOrder ? { [sortBy]: sortOrder } : { createdAt: "desc" },
    include: {
      practical: true,
      student: true,
    },
  });

  const total = await prisma.practicalSubmission.count({
    where: whereConditions,
  });

  return {
    meta: { page, limit, total },
    data: result,
  };
};

const updateSubmission = async (
  practicalId: number,
  studentId: number,
  payload: IUpdatePracticalSubmission,
): Promise<PracticalSubmission> => {
  const existing = await prisma.practicalSubmission.findUnique({
    where: { practicalId_studentId: { practicalId, studentId } },
  });

  if (!existing) {
    throw new ApiError(httpStatus.NOT_FOUND, "Submission not found");
  }

  if (payload.obtainedMarks !== undefined) {
    const practical = await prisma.practical.findUnique({
      where: { id: practicalId },
    });

    if (practical && payload.obtainedMarks > practical.totalMarks) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Obtained marks cannot exceed total marks (${practical.totalMarks})`,
      );
    }
  }

  const submission = await prisma.practicalSubmission.update({
    where: { practicalId_studentId: { practicalId, studentId } },
    data: payload,
    include: {
      practical: true,
      student: true,
    },
  });

  return submission;
};

const bulkUpdateSubmissions = async (
  practicalId: number,
  payload: IBulkUpdateSubmissions,
): Promise<{ count: number }> => {
  const practical = await prisma.practical.findFirst({
    where: { id: practicalId, isDeleted: false },
  });

  if (!practical) {
    throw new ApiError(httpStatus.NOT_FOUND, "Practical not found");
  }

  // Validate marks
  for (const sub of payload.submissions) {
    if (
      sub.obtainedMarks !== undefined &&
      sub.obtainedMarks > practical.totalMarks
    ) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Obtained marks for student ${sub.studentId} cannot exceed total marks (${practical.totalMarks})`,
      );
    }
  }

  let count = 0;
  await prisma.$transaction(
    payload.submissions.map((sub) =>
      prisma.practicalSubmission.updateMany({
        where: { practicalId, studentId: sub.studentId },
        data: {
          obtainedMarks: sub.obtainedMarks,
          submitted: sub.submitted,
        },
      }),
    ),
  );

  count = payload.submissions.length;

  return { count };
};

const deleteSubmission = async (
  practicalId: number,
  studentId: number,
): Promise<PracticalSubmission> => {
  const existing = await prisma.practicalSubmission.findUnique({
    where: { practicalId_studentId: { practicalId, studentId } },
  });

  if (!existing) {
    throw new ApiError(httpStatus.NOT_FOUND, "Submission not found");
  }

  const submission = await prisma.practicalSubmission.delete({
    where: { practicalId_studentId: { practicalId, studentId } },
  });

  return submission;
};

export const practicalService = {
  createPractical,
  getAllPracticals,
  getPracticalById,
  updatePractical,
  deletePractical,
  createSubmission,
  bulkCreateSubmissions,
  getSubmissionsByPractical,
  updateSubmission,
  bulkUpdateSubmissions,
  deleteSubmission,
};
