import { AttendanceStatus, Prisma } from "@prisma/client";
import { IPaginationOptions } from "../../interfaces/pagination";
import { prisma } from "../../shared/prisma";
import ApiError from "../../errors/api.error";
import httpStatus from "http-status";
import { IAttendanceSessionFilterRequest, ICreateAttendanceWithRecords, IUpdateAttendanceRecord } from "./attendence.interface";
import { paginationHelper } from "../../helper/paginationHelper";



const createSessionWithRecords = async (payload: ICreateAttendanceWithRecords) => {
  const { session, records } = payload;

  // Prevent duplicate session
  const existing = await prisma.attendanceSession.findUnique({
    where: {
      groupId_subjectId_semesterId_date: {
        groupId: session.groupId,
        subjectId: session.subjectId,
        semesterId: session.semesterId,
        date: new Date(session.date),
      },
    },
  });

  if (existing && !existing.isDeleted) {
    throw new ApiError(
      httpStatus.CONFLICT,
      "Attendance session already exists for this group, subject, semester and date"
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    const attendanceSession = await tx.attendanceSession.create({
      data: {
        groupId: session.groupId,
        semesterId: session.semesterId,
        subjectId: session.subjectId,
        teacherId: session.teacherId ?? null,
        crStudentId: session.crStudentId ?? null,
        takenByRole: session.takenByRole,
        date: new Date(session.date),
      },
    });

    await tx.attendanceRecord.createMany({
      data: records.map((record) => ({
        attendanceSessionId: attendanceSession.id,
        studentId: record.studentId,
        status: record.status,
      })),
    });

    return tx.attendanceSession.findUnique({
      where: { id: attendanceSession.id },
      include: { records: true },
    });
  });

  return result;
};

const getAllSessions = async (
  filters: IAttendanceSessionFilterRequest,
  options: IPaginationOptions
) => {
  const { page, limit, skip, sortBy, sortOrder } =
    paginationHelper.calculatePagination(options);

  const { groupId, semesterId, subjectId, teacherId, crStudentId, takenByRole, date } =
    filters;

  const andConditions: Prisma.AttendanceSessionWhereInput[] = [
    { isDeleted: false },
  ];

  if (groupId) andConditions.push({ groupId: Number(groupId) });
  if (semesterId) andConditions.push({ semesterId: Number(semesterId) });
  if (subjectId) andConditions.push({ subjectId: Number(subjectId) });
  if (teacherId) andConditions.push({ teacherId: Number(teacherId) });
  if (crStudentId) andConditions.push({ crStudentId: Number(crStudentId) });
  if (takenByRole) andConditions.push({ takenByRole });
  if (date) andConditions.push({ date: new Date(date) });

  const where: Prisma.AttendanceSessionWhereInput = { AND: andConditions };

  const [data, total] = await Promise.all([
    prisma.attendanceSession.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy || "createdAt"]: sortOrder || "desc" },
      include: {
        group: { include: { department: true, shift: true } },
        semester: true,
        subject: true,
        teacher: true,
        records: { include: { student: true } },
      },
    }),
    prisma.attendanceSession.count({ where }),
  ]);

  return {
    meta: { page, limit, total },
    data,
  };
};

const getSessionById = async (id: number) => {
  const session = await prisma.attendanceSession.findUnique({
    where: { id },
    include: {
      group: { include: { department: true, shift: true } },
      semester: true,
      subject: true,
      teacher: true,
      records: { include: { student: true } },
    },
  });

  if (!session || session.isDeleted) {
    throw new ApiError(httpStatus.NOT_FOUND, "Attendance session not found");
  }

  return session;
};

const deleteSession = async (id: number) => {
  const session = await prisma.attendanceSession.findUnique({ where: { id } });

  if (!session || session.isDeleted) {
    throw new ApiError(httpStatus.NOT_FOUND, "Attendance session not found");
  }

  return prisma.attendanceSession.update({
    where: { id },
    data: { isDeleted: true },
  });
};

// ─── Records ────────────────────────────────────────────────────────────────

const updateSessionRecords = async (
  sessionId: number,
  records: IUpdateAttendanceRecord[]
) => {
  const session = await prisma.attendanceSession.findUnique({
    where: { id: sessionId },
  });

  if (!session || session.isDeleted) {
    throw new ApiError(httpStatus.NOT_FOUND, "Attendance session not found");
  }

  const updated = await prisma.$transaction(
    records.map((record) =>
      prisma.attendanceRecord.upsert({
        where: {
          attendanceSessionId_studentId: {
            attendanceSessionId: sessionId,
            studentId: record.studentId,
          },
        },
        update: { status: record.status },
        create: {
          attendanceSessionId: sessionId,
          studentId: record.studentId,
          status: record.status,
        },
      })
    )
  );

  return updated;
};

const getStudentAttendanceBySemester = async (
  studentId: number,
  semesterId: number
) => {
  const records = await prisma.attendanceRecord.findMany({
    where: {
      studentId,
      session: { semesterId, isDeleted: false },
    },
    include: {
      session: { include: { subject: true, group: true } },
    },
    orderBy: { session: { date: "asc" } },
  });

  // Summary per subject
  const summary: Record<
    number,
    { subjectName: string; total: number; present: number; absent: number; late: number }
  > = {};

  for (const record of records) {
    const subjectId = record.session.subjectId;
    if (!summary[subjectId]) {
      summary[subjectId] = {
        subjectName: record.session.subject.name,
        total: 0,
        present: 0,
        absent: 0,
        late: 0,
      };
    }
    summary[subjectId].total += 1;
    if (record.status === AttendanceStatus.PRESENT) summary[subjectId].present += 1;
    if (record.status === AttendanceStatus.ABSENT) summary[subjectId].absent += 1;
    if (record.status === AttendanceStatus.LATE) summary[subjectId].late += 1;
  }

  return { records, summary: Object.values(summary) };
};

export const attendanceService = {
  createSessionWithRecords,
  getAllSessions,
  getSessionById,
  deleteSession,
  updateSessionRecords,
  getStudentAttendanceBySemester,
};