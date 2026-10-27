import { prisma } from "../../shared/prisma";
import ApiError from "../../errors/api.error";
import httpStatus from "http-status";

const getTeacherStudentReports = async (userId: number, filters?: {
  subjectGroupId?: number;
  groupId?: number;
}) => {
  // 1. Find teacher
  const teacher = await prisma.teacher.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (!teacher) {
    throw new ApiError(httpStatus.NOT_FOUND, "Teacher not found");
  }

  // 2. Get teacher's subject groups
  const subjectGroups = await prisma.subjectGroup.findMany({
    where: {
      teacherId: teacher.id,
      isDeleted: false,
      ...(filters?.subjectGroupId && { id: filters.subjectGroupId }),
      ...(filters?.groupId && { groupId: filters.groupId }),
    },
    select: {
      id: true,
      subjectId: true,
      groupId: true,
      semesterId: true,
      subject: {
        select: { id: true, name: true, code: true, shortName: true },
      },
      group: {
        select: {
          id: true,
          name: true,
          session: true,
          currentSemester: { select: { id: true, name: true } },
        },
      },
      semester: {
        select: { id: true, name: true },
      },
    },
  });

  if (subjectGroups.length === 0) {
    return [];
  }

  const reports = [];

  for (const sg of subjectGroups) {
    // 3. Get students of this group (prefer ongoing enrollment)
    const enrollments = await prisma.studentEnrollment.findMany({
      where: {
        groupId: sg.groupId,
        semesterId: sg.semesterId,
        status: "ONGOING",
        isDeleted: false,
      },
      select: {
        id: true,
        studentId: true,
        attemptNumber: true,
        student: {
          select: {
            id: true,
            name: true,
            roll: true,
            registration: true,
            email: true,
            mobile: true,
            profilePhoto: true,
          },
        },
      },
    });

    // Fallback: if no enrollment, use group students
    let studentsData = enrollments;

    if (studentsData.length === 0) {
      const groupStudents = await prisma.student.findMany({
        where: {
          groupId: sg.groupId,
          isDeleted: false,
        },
        select: {
          id: true,
          name: true,
          roll: true,
          registration: true,
          email: true,
          mobile: true,
          profilePhoto: true,
        },
      });

      studentsData = groupStudents.map((s) => ({
        id: 0,
        studentId: s.id,
        attemptNumber: 1,
        student: s,
      }));
    }

    const studentReports = [];

    for (const item of studentsData) {
      const student = item.student;
      const enrollmentId = item.id || null;

      // ── Attendance ──
      const attendanceRecords = await prisma.attendanceRecord.findMany({
        where: {
          studentId: student.id,
          session: {
            groupId: sg.groupId,
            subjectId: sg.subjectId,
            semesterId: sg.semesterId,
            isDeleted: false,
          },
        },
        select: { status: true },
      });

      const totalAttendance = attendanceRecords.length;
      const presentCount = attendanceRecords.filter(
        (r) => r.status === "PRESENT" || r.status === "LATE"
      ).length;
      const absentCount = attendanceRecords.filter(
        (r) => r.status === "ABSENT"
      ).length;
      const lateCount = attendanceRecords.filter(
        (r) => r.status === "LATE"
      ).length;

      const attendancePercentage =
        totalAttendance > 0
          ? Math.round((presentCount / totalAttendance) * 100)
          : 0;

      // ── Practical / Job ──
      const practicals = await prisma.practical.findMany({
        where: {
          subjectGroupId: sg.id,
          isDeleted: false,
        },
        select: {
          id: true,
          title: true,
          totalMarks: true,
          type: true,
          givenDate: true,
          submissionDeadline: true,
          submissions: {
            where: {
              studentId: student.id,
              ...(enrollmentId ? { enrollmentId } : {}),
            },
            select: {
              id: true,
              obtainedMarks: true,
              submitted: true,
            },
          },
        },
      });

      const practicalSummary = practicals.map((p) => {
        const submission = p.submissions[0] || null;
        return {
          practicalId: p.id,
          title: p.title,
          type: p.type,
          totalMarks: p.totalMarks,
          givenDate: p.givenDate,
          submissionDeadline: p.submissionDeadline,
          submitted: submission?.submitted || false,
          obtainedMarks: submission?.obtainedMarks ?? null,
        };
      });

      const totalPracticals = practicals.length;
      const submittedPracticals = practicalSummary.filter((p) => p.submitted).length;
      const pendingPracticals = totalPracticals - submittedPracticals;

      studentReports.push({
        student: {
          id: student.id,
          name: student.name,
          roll: student.roll,
          registration: student.registration,
          email: student.email,
          mobile: student.mobile,
          profilePhoto: student.profilePhoto,
          attemptNumber: item.attemptNumber,
        },
        attendance: {
          total: totalAttendance,
          present: presentCount,
          absent: absentCount,
          late: lateCount,
          percentage: attendancePercentage,
        },
        practical: {
          total: totalPracticals,
          submitted: submittedPracticals,
          pending: pendingPracticals,
          list: practicalSummary,
        },
      });
    }

    // Sort by roll
    studentReports.sort((a, b) =>
      a.student.roll.localeCompare(b.student.roll)
    );

    reports.push({
      subjectGroup: {
        id: sg.id,
        subject: sg.subject,
        group: sg.group,
        semester: sg.semester,
      },
      totalStudents: studentReports.length,
      students: studentReports,
    });
  }

  return reports;
};

// Single student detailed report under a subject group
const getStudentReportBySubjectGroup = async (
  userId: number,
  subjectGroupId: number,
  studentId: number
) => {
  const teacher = await prisma.teacher.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (!teacher) {
    throw new ApiError(httpStatus.NOT_FOUND, "Teacher not found");
  }

  const subjectGroup = await prisma.subjectGroup.findFirst({
    where: {
      id: subjectGroupId,
      teacherId: teacher.id,
      isDeleted: false,
    },
    select: {
      id: true,
      subjectId: true,
      groupId: true,
      semesterId: true,
      subject: {
        select: { id: true, name: true, code: true },
      },
      group: {
        select: { id: true, name: true, session: true },
      },
      semester: {
        select: { id: true, name: true },
      },
    },
  });

  if (!subjectGroup) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "You are not assigned to this subject group"
    );
  }

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: {
      id: true,
      name: true,
      roll: true,
      registration: true,
      email: true,
      mobile: true,
      profilePhoto: true,
    },
  });

  if (!student) {
    throw new ApiError(httpStatus.NOT_FOUND, "Student not found");
  }

  // Attendance details
  const attendanceRecords = await prisma.attendanceRecord.findMany({
    where: {
      studentId,
      session: {
        groupId: subjectGroup.groupId,
        subjectId: subjectGroup.subjectId,
        semesterId: subjectGroup.semesterId,
        isDeleted: false,
      },
    },
    select: {
      id: true,
      status: true,
      session: {
        select: {
          id: true,
          date: true,
        },
      },
    },
    orderBy: {
      session: { date: "asc" },
    },
  });

  const totalAttendance = attendanceRecords.length;
  const presentCount = attendanceRecords.filter(
    (r) => r.status === "PRESENT" || r.status === "LATE"
  ).length;

  // Practical details
  const practicals = await prisma.practical.findMany({
    where: {
      subjectGroupId: subjectGroup.id,
      isDeleted: false,
    },
    select: {
      id: true,
      title: true,
      totalMarks: true,
      type: true,
      givenDate: true,
      submissionDeadline: true,
      submissions: {
        where: { studentId },
        select: {
          id: true,
          obtainedMarks: true,
          submitted: true,
          createdAt: true,
        },
      },
    },
    orderBy: { givenDate: "asc" },
  });

  return {
    subjectGroup,
    student,
    attendance: {
      total: totalAttendance,
      present: presentCount,
      percentage:
        totalAttendance > 0
          ? Math.round((presentCount / totalAttendance) * 100)
          : 0,
      records: attendanceRecords.map((r) => ({
        date: r.session.date,
        status: r.status,
      })),
    },
    practicals: practicals.map((p) => ({
      id: p.id,
      title: p.title,
      type: p.type,
      totalMarks: p.totalMarks,
      givenDate: p.givenDate,
      submissionDeadline: p.submissionDeadline,
      submitted: p.submissions[0]?.submitted || false,
      obtainedMarks: p.submissions[0]?.obtainedMarks ?? null,
      submittedAt: p.submissions[0]?.createdAt ?? null,
    })),
  };
};

export const reportService = {
  getTeacherStudentReports,
  getStudentReportBySubjectGroup,
};