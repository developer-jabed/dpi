import { prisma } from "../../shared/prisma";
import ApiError from "../../errors/api.error";
import httpStatus from "http-status";

const getMyOverview = async (user: { userId: number; role: string }) => {
  // ────────────────────────────────────────────────
  // TEACHER OVERVIEW
  // ────────────────────────────────────────────────
  if (user.role === "TEACHER") {
    const teacher = await prisma.teacher.findUnique({
      where: { userId: user.userId },
      select: {
        id: true,
        name: true,
        email: true,
        designation: true,
        department: {
          select: { id: true, name: true, shortName: true },
        },
      },
    });

    if (!teacher) {
      throw new ApiError(httpStatus.NOT_FOUND, "Teacher not found");
    }

    // Subject Groups assigned to this teacher
    const subjectGroups = await prisma.subjectGroup.findMany({
      where: {
        teacherId: teacher.id,
        isDeleted: false,
      },
      select: {
        id: true,
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
        semester: { select: { id: true, name: true } },
      },
    });

    // Total classes (routines)
    const totalClasses = await prisma.classRoutine.count({
      where: {
        isActive: true,
        subjectGroup: { teacherId: teacher.id },
      },
    });

    // Attendance sessions taken by this teacher
    const attendanceSessions = await prisma.attendanceSession.findMany({
      where: {
        teacherId: teacher.id,
        isDeleted: false,
      },
      select: {
        id: true,
        date: true,
        subjectId: true,
        groupId: true,
        _count: {
          select: { records: true },
        },
      },
      orderBy: { date: "desc" },
      take: 10, // recent 10
    });

    const totalAttendanceTaken = await prisma.attendanceSession.count({
      where: {
        teacherId: teacher.id,
        isDeleted: false,
      },
    });

    // Practicals created by this teacher
    const practicals = await prisma.practical.findMany({
      where: {
        subjectGroup: { teacherId: teacher.id },
        isDeleted: false,
      },
      select: {
        id: true,
        title: true,
        totalMarks: true,
        type: true,
        givenDate: true,
        submissionDeadline: true,
        subjectGroup: {
          select: {
            subject: { select: { name: true, code: true } },
            group: { select: { name: true } },
          },
        },
        _count: {
          select: { submissions: true },
        },
      },
      orderBy: { givenDate: "desc" },
      take: 5,
    });

    return {
      role: "TEACHER",
      profile: teacher,
      summary: {
        totalSubjectGroups: subjectGroups.length,
        totalClasses,
        totalAttendanceTaken,
        totalPracticals: practicals.length,
      },
      subjectGroups,
      recentAttendanceSessions: attendanceSessions,
      recentPracticals: practicals,
    };
  }

  // ────────────────────────────────────────────────
  // STUDENT OVERVIEW
  // ────────────────────────────────────────────────
  if (user.role === "STUDENT") {
    const student = await prisma.student.findUnique({
      where: { userId: user.userId },
      select: {
        id: true,
        name: true,
        email: true,
        roll: true,
        registration: true,
        profilePhoto: true,
        currentAttempt: true,
        department: {
          select: { id: true, name: true, shortName: true },
        },
        group: {
          select: {
            id: true,
            name: true,
            session: true,
            currentSemester: { select: { id: true, name: true } },
            shift: { select: { name: true, shortName: true } },
          },
        },
        currentSemester: {
          select: { id: true, name: true },
        },
      },
    });

    if (!student) {
      throw new ApiError(httpStatus.NOT_FOUND, "Student not found");
    }

    // Current enrollment
    const currentEnrollment = await prisma.studentEnrollment.findFirst({
      where: {
        studentId: student.id,
        status: "ONGOING",
        isDeleted: false,
      },
      orderBy: { startedAt: "desc" },
      select: {
        id: true,
        groupId: true,
        semesterId: true,
        attemptNumber: true,
        status: true,
        semester: { select: { id: true, name: true } },
        group: {
          select: {
            id: true,
            name: true,
            session: true,
          },
        },
      },
    });

    const groupId = currentEnrollment?.groupId || student.group?.id;
    const semesterId =
      currentEnrollment?.semesterId || student.currentSemester?.id;

    // ── Attendance Percentage ──
    let attendancePercentage = 0;
    let totalAttendanceRecords = 0;
    let presentCount = 0;

    if (groupId && semesterId) {
      const attendanceRecords = await prisma.attendanceRecord.findMany({
        where: {
          studentId: student.id,
          session: {
            groupId,
            semesterId,
            isDeleted: false,
          },
        },
        select: {
          status: true,
        },
      });

      totalAttendanceRecords = attendanceRecords.length;
      presentCount = attendanceRecords.filter(
        (r) => r.status === "PRESENT" || r.status === "LATE"
      ).length;

      attendancePercentage =
        totalAttendanceRecords > 0
          ? Math.round((presentCount / totalAttendanceRecords) * 100)
          : 0;
    }

    // ── Practical / Job Status ──
    const practicalSubmissions = await prisma.practicalSubmission.findMany({
      where: {
        studentId: student.id,
        ...(currentEnrollment && { enrollmentId: currentEnrollment.id }),
      },
      select: {
        id: true,
        obtainedMarks: true,
        submitted: true,
        practical: {
          select: {
            id: true,
            title: true,
            totalMarks: true,
            type: true,
            givenDate: true,
            submissionDeadline: true,
            subjectGroup: {
              select: {
                subject: { select: { name: true, code: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const totalPracticals = practicalSubmissions.length;
    const submittedPracticals = practicalSubmissions.filter(
      (p) => p.submitted
    ).length;
    const pendingPracticals = totalPracticals - submittedPracticals;

    // ── Routine Count ──
    const totalClasses = groupId
      ? await prisma.classRoutine.count({
          where: { groupId, isActive: true },
        })
      : 0;

    // ── Recent Notices (for this group/department) ──
    const notices = await prisma.notice.findMany({
      where: {
        isPublished: true,
        OR: [
          { audienceType: "ALL" },
          { groupId },
          { departmentId: student.department?.id },
          { studentId: student.id },
        ],
      },
      select: {
        id: true,
        title: true,
        priority: true,
        noticeDate: true,
        isPinned: true,
      },
      orderBy: [{ isPinned: "desc" }, { noticeDate: "desc" }],
      take: 5,
    });

    return {
      role: "STUDENT",
      profile: {
        ...student,
        currentEnrollment,
      },
      summary: {
        attendancePercentage,
        totalAttendanceRecords,
        presentCount,
        totalClasses,
        totalPracticals,
        submittedPracticals,
        pendingPracticals,
      },
      practicals: practicalSubmissions,
      recentNotices: notices,
    };
  }

  throw new ApiError(
    httpStatus.FORBIDDEN,
    "Only Teacher and Student can access overview"
  );
};

export const overviewService = {
  getMyOverview,
};