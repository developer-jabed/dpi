import { prisma } from "../../shared/prisma";
import ApiError from "../../errors/api.error";
import httpStatus from "http-status";


const getLast12Months = () => {
  const months = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      label: d.toLocaleString("default", { month: "short", year: "2-digit" }),
      start: new Date(d.getFullYear(), d.getMonth(), 1),
      end: new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59),
    });
  }
  return months;
};

const getLastMonthRange = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
  return { start, end };
};


export const getAdminDashboard = async () => {
  const months = getLast12Months();
  const { start: lastMonthStart, end: lastMonthEnd } = getLastMonthRange();


  const [
    totalStudents,
    totalTeachers,
    totalGroups,
    totalDepartments,
    totalSubjects,
    totalSubjectGroups,
    totalNotices,
    publishedNotices,
    totalEvents,
    totalAttendanceSessions,
    totalPracticals,
    totalPracticalJobs,
    // FIX: added orderBy to every groupBy
    attendanceOverview,
    diplomaResultStats,
    noticesByAudience,
    noticesByPriority,
    recentNotices,
    recentEvents,
    studentsByDepartment,
    teachersByDepartment,
    groupsByDepartment,
  ] = await prisma.$transaction([
    prisma.student.count({ where: { isDeleted: false } }),
    prisma.teacher.count({ where: { isDeleted: false } }),
    prisma.group.count({ where: { isDeleted: false } }),
    prisma.department.count({ where: { isDeleted: false } }),
    prisma.subject.count({ where: { isDeleted: false } }),
    prisma.subjectGroup.count({ where: { isDeleted: false } }),
    prisma.notice.count(),
    prisma.notice.count({ where: { isPublished: true } }),
    prisma.event.count(),
    prisma.attendanceSession.count({ where: { isDeleted: false } }),
    prisma.practical.count({ where: { isDeleted: false, type: "PRACTICAL" } }),
    prisma.practical.count({ where: { isDeleted: false, type: "JOB" } }),

    // FIX TS2345 – orderBy required by this Prisma version
    prisma.attendanceRecord.groupBy({
      by: ["status"],
      orderBy: { status: "asc" },
      _count: { id: true },
    }),

    prisma.diplomaResult.groupBy({
      by: ["status"],
      where: { isDeleted: false },
      orderBy: { status: "asc" },
      _count: { id: true },
    }),

    prisma.notice.groupBy({
      by: ["audienceType"],
      orderBy: { audienceType: "asc" },
      _count: { id: true },
    }),

    prisma.notice.groupBy({
      by: ["priority"],
      orderBy: { priority: "asc" },
      _count: { id: true },
    }),

    prisma.notice.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        audienceType: true,
        priority: true,
        isPublished: true,
        createdAt: true,
      },
    }),

    prisma.event.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        eventType: true,
        eventDate: true,
        location: true,
      },
    }),

    // FIX TS2345 – orderBy required
    prisma.student.groupBy({
      by: ["departmentId"],
      where: { isDeleted: false },
      orderBy: { departmentId: "asc" },
      _count: { id: true },
    }),

    prisma.teacher.groupBy({
      by: ["departmentId"],
      where: { isDeleted: false },
      orderBy: { departmentId: "asc" },
      _count: { id: true },
    }),

    prisma.group.groupBy({
      by: ["departmentId"],
      where: { isDeleted: false },
      orderBy: { departmentId: "asc" },
      _count: { id: true },
    }),
  ]);

  // ── 2. Last Semester Diploma Results ────────────────────────
  const lastResultSemester = await prisma.diplomaResult.findFirst({
    where: { isDeleted: false },
    orderBy: { createdAt: "desc" },
    select: { semesterId: true, semesterName: true, examYear: true },
  });

  let lastSemesterResults = null;
  if (lastResultSemester) {
    const [semesterResultStats, semesterGPAStats] = await Promise.all([
      prisma.diplomaResult.groupBy({
        by: ["status"],
        where: {
          isDeleted: false,
          semesterName: lastResultSemester.semesterName,
          examYear: lastResultSemester.examYear,
        },
        orderBy: { status: "asc" }, // FIX
        _count: { id: true },
      }),
      prisma.diplomaResult.aggregate({
        where: {
          isDeleted: false,
          semesterName: lastResultSemester.semesterName,
          examYear: lastResultSemester.examYear,
          status: "PASSED",
        },
        _avg: { gpa1: true },
        _max: { gpa1: true },
        _min: { gpa1: true },
      }),
    ]);

    const semTotal = semesterResultStats.reduce((s, d) => s + d._count.id, 0);
    const semPassed = semesterResultStats.find((d) => d.status === "PASSED")?._count.id ?? 0;
    const semFailed = semesterResultStats.find((d) => d.status === "FAILED")?._count.id ?? 0;
    const semReferred = semesterResultStats.find((d) => d.status === "REFERRED")?._count.id ?? 0;
    const semWithheld = semesterResultStats.find((d) => d.status === "WITHHELD")?._count.id ?? 0;

    lastSemesterResults = {
      semesterName: lastResultSemester.semesterName,
      examYear: lastResultSemester.examYear,
      total: semTotal,
      passed: semPassed,
      failed: semFailed,
      referred: semReferred,
      withheld: semWithheld,
      passRate: semTotal > 0 ? Math.round((semPassed / semTotal) * 100) : 0,
      failRate: semTotal > 0 ? Math.round((semFailed / semTotal) * 100) : 0,
      referredRate: semTotal > 0 ? Math.round((semReferred / semTotal) * 100) : 0,
      gpa: {
        avgGpa1: semesterGPAStats._avg.gpa1 != null ? Math.round(semesterGPAStats._avg.gpa1 * 100) / 100 : null,
        maxGpa1: semesterGPAStats._max.gpa1 ?? null,
        minGpa1: semesterGPAStats._min.gpa1 ?? null,
      },
    };
  }

  // ── 3. Last Month Attendance ─────────────────────────────────
  const groupsForAttendance = await prisma.group.findMany({
    where: { isDeleted: false },
    select: {
      id: true,
      name: true,
      session: true,
      departmentId: true,
      currentSemester: { select: { name: true } },
    },
  });

  const groupAttendanceLastMonth = await Promise.all(
    groupsForAttendance.map(async (g) => {
      const records = await prisma.attendanceRecord.groupBy({
        by: ["status"],
        where: {
          session: { groupId: g.id, date: { gte: lastMonthStart, lte: lastMonthEnd } },
        },
        orderBy: { status: "asc" }, // FIX
        _count: { id: true },
      });

      const present = records.find((r) => r.status === "PRESENT")?._count.id ?? 0;
      const absent = records.find((r) => r.status === "ABSENT")?._count.id ?? 0;
      const late = records.find((r) => r.status === "LATE")?._count.id ?? 0;
      const total = present + absent + late;
      const semesterName = g.currentSemester?.name ?? "";

      return {
        groupId: g.id,
        groupName: g.name,
        semesterName,
        displayName: semesterName ? `${semesterName} ${g.name}` : g.name,
        departmentId: g.departmentId,
        present,
        absent,
        late,
        total,
        attendanceRate: total > 0 ? Math.round((present / total) * 100) : 0,
      };
    }),
  );

  const lastMonthRecords = await prisma.attendanceRecord.groupBy({
    by: ["status"],
    where: { session: { date: { gte: lastMonthStart, lte: lastMonthEnd } } },
    orderBy: { status: "asc" }, // FIX
    _count: { id: true },
  });

  const lastMonthPresent = lastMonthRecords.find((r) => r.status === "PRESENT")?._count.id ?? 0;
  const lastMonthAbsent = lastMonthRecords.find((r) => r.status === "ABSENT")?._count.id ?? 0;
  const lastMonthLate = lastMonthRecords.find((r) => r.status === "LATE")?._count.id ?? 0;
  const lastMonthTotal = lastMonthPresent + lastMonthAbsent + lastMonthLate;

  const lastMonthAttendance = {
    month: lastMonthStart.toLocaleString("default", { month: "long", year: "numeric" }),
    sessions: await prisma.attendanceSession.count({
      where: { isDeleted: false, date: { gte: lastMonthStart, lte: lastMonthEnd } },
    }),
    present: lastMonthPresent,
    absent: lastMonthAbsent,
    late: lastMonthLate,
    total: lastMonthTotal,
    attendanceRate: lastMonthTotal > 0 ? Math.round((lastMonthPresent / lastMonthTotal) * 100) : 0,
    byGroup: groupAttendanceLastMonth.sort((a, b) => b.attendanceRate - a.attendanceRate),
  };

  // ── 4. Monthly Data ──────────────────────────────────────────
  const monthlyAttendance = await Promise.all(
    months.map(async (m) => {
      const [sessions, records] = await Promise.all([
        prisma.attendanceSession.count({
          where: { isDeleted: false, date: { gte: m.start, lte: m.end } },
        }),
        prisma.attendanceRecord.groupBy({
          by: ["status"],
          where: { session: { date: { gte: m.start, lte: m.end } } },
          orderBy: { status: "asc" }, // FIX
          _count: { id: true },
        }),
      ]);

      const present = records.find((r) => r.status === "PRESENT")?._count.id ?? 0;
      const absent = records.find((r) => r.status === "ABSENT")?._count.id ?? 0;
      const late = records.find((r) => r.status === "LATE")?._count.id ?? 0;
      const total = present + absent + late;

      return {
        label: m.label,
        year: m.year,
        month: m.month,
        sessions,
        present,
        absent,
        late,
        total,
        attendanceRate: total > 0 ? Math.round((present / total) * 100) : 0,
      };
    }),
  );

  const monthlyDiplomaResults = await Promise.all(
    months.map(async (m) => {
      const results = await prisma.diplomaResult.groupBy({
        by: ["status"],
        where: { isDeleted: false, createdAt: { gte: m.start, lte: m.end } },
        orderBy: { status: "asc" }, // FIX
        _count: { id: true },
      });

      const passed = results.find((r) => r.status === "PASSED")?._count.id ?? 0;
      const failed = results.find((r) => r.status === "FAILED")?._count.id ?? 0;
      const referred = results.find((r) => r.status === "REFERRED")?._count.id ?? 0;
      const withheld = results.find((r) => r.status === "WITHHELD")?._count.id ?? 0;
      const total = passed + failed + referred + withheld;

      return {
        label: m.label,
        year: m.year,
        month: m.month,
        passed,
        failed,
        referred,
        withheld,
        total,
        passRate: total > 0 ? Math.round((passed / total) * 100) : 0,
      };
    }),
  );

  // ── 5. Diploma Analysis ──────────────────────────────────────
  const [
    diplomaBySemesterName,
    diplomaByExamYear,
    diplomaGPADistribution,
    topReferredSubjectsRaw,
    topFailedSubjectsRaw,
  ] = await Promise.all([
    prisma.diplomaResult.groupBy({
      by: ["semesterName", "status"],
      where: { isDeleted: false },
      orderBy: { semesterName: "asc" }, // FIX
      _count: { id: true },
    }),
    prisma.diplomaResult.groupBy({
      by: ["examYear", "status"],
      where: { isDeleted: false },
      orderBy: { examYear: "asc" }, // FIX
      _count: { id: true },
    }),
    prisma.diplomaResult.groupBy({
      by: ["semesterName"],
      where: { isDeleted: false, status: "PASSED", gpa1: { not: null } },
      orderBy: { semesterName: "asc" }, // FIX
      _avg: { gpa1: true },
      _count: { id: true },
    }),
    prisma.diplomaResult.findMany({
      where: { isDeleted: false, status: "REFERRED", referredSubjects: { isEmpty: false } },
      select: { referredSubjects: true },
    }),
    prisma.diplomaResult.findMany({
      where: { isDeleted: false, status: "FAILED", failedSubjects: { isEmpty: false } },
      select: { failedSubjects: true },
    }),
  ]);

  // Process top subjects
  const referredFreq: Record<string, number> = {};
  topReferredSubjectsRaw.forEach((r) =>
    r.referredSubjects.forEach((s) => (referredFreq[s] = (referredFreq[s] ?? 0) + 1)),
  );
  const topReferredSubjects = Object.entries(referredFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([subject, count]) => ({ subject, count }));

  const failedFreq: Record<string, number> = {};
  topFailedSubjectsRaw.forEach((r) =>
    r.failedSubjects.forEach((s) => (failedFreq[s] = (failedFreq[s] ?? 0) + 1)),
  );
  const topFailedSubjects = Object.entries(failedFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([subject, count]) => ({ subject, count }));

  // Pivot by semester
  const bySemester: Record<string, { passed: number; failed: number; referred: number; withheld: number; total: number; passRate: number }> = {};
  diplomaBySemesterName.forEach(({ semesterName, status, _count }) => {
    if (!bySemester[semesterName])
      bySemester[semesterName] = { passed: 0, failed: 0, referred: 0, withheld: 0, total: 0, passRate: 0 };
    const key = status.toLowerCase() as keyof typeof bySemester[string];
    if (key in bySemester[semesterName]) (bySemester[semesterName] as any)[key] = _count.id;
    bySemester[semesterName].total += _count.id;
  });
  Object.values(bySemester).forEach(
    (v) => (v.passRate = v.total > 0 ? Math.round((v.passed / v.total) * 100) : 0),
  );

  // Pivot by year
  const byYear: Record<number, { passed: number; failed: number; referred: number; withheld: number; total: number; passRate: number }> = {};
  diplomaByExamYear.forEach(({ examYear, status, _count }) => {
    if (!byYear[examYear])
      byYear[examYear] = { passed: 0, failed: 0, referred: 0, withheld: 0, total: 0, passRate: 0 };
    const key = status.toLowerCase() as keyof typeof byYear[number];
    if (key in byYear[examYear]) (byYear[examYear] as any)[key] = _count.id;
    byYear[examYear].total += _count.id;
  });
  Object.values(byYear).forEach(
    (v) => (v.passRate = v.total > 0 ? Math.round((v.passed / v.total) * 100) : 0),
  );

  // Dept enrichment
  const departments = await prisma.department.findMany({
    where: { isDeleted: false },
    select: { id: true, name: true, shortName: true },
  });
  const enrichWithDept = (groups: { departmentId: number; _count: { id: number } }[]) =>
    groups.map((g) => ({
      department: departments.find((d) => d.id === g.departmentId) ?? null,
      count: g._count.id,
    }));

  // Overall rates
  const totalAttRecords = attendanceOverview.reduce((s, a) => s + a._count.id, 0);
  const presentCount = attendanceOverview.find((a) => a.status === "PRESENT")?._count.id ?? 0;
  const overallAttendanceRate = totalAttRecords > 0 ? Math.round((presentCount / totalAttRecords) * 100) : 0;

  const totalDiploma = diplomaResultStats.reduce((s, d) => s + d._count.id, 0);
  const passedCount = diplomaResultStats.find((d) => d.status === "PASSED")?._count.id ?? 0;
  const diplomaPassRate = totalDiploma > 0 ? Math.round((passedCount / totalDiploma) * 100) : 0;

  return {
    overview: {
      totalStudents,
      totalTeachers,
      totalGroups,
      totalDepartments,
      totalSubjects,
      totalSubjectGroups,
      totalNotices,
      publishedNotices,
      totalEvents,
      totalAttendanceSessions,
      totalPracticals,
      totalPracticalJobs,
      totalPracticalCombined: totalPracticals + totalPracticalJobs,
      overallAttendanceRate,
      diplomaPassRate,
    },
    breakdowns: {
      studentsByDepartment: enrichWithDept(studentsByDepartment),
      teachersByDepartment: enrichWithDept(teachersByDepartment),
      groupsByDepartment: enrichWithDept(groupsByDepartment),
      noticesByAudience: noticesByAudience.map((n) => ({ audienceType: n.audienceType, count: n._count.id })),
      noticesByPriority: noticesByPriority.map((n) => ({ priority: n.priority, count: n._count.id })),
      diplomaResults: diplomaResultStats.map((d) => ({ status: d.status, count: d._count.id })),
      attendance: attendanceOverview.map((a) => ({ status: a.status, count: a._count.id })),
    },
    lastSemesterDiplomaResults: lastSemesterResults,
    lastMonthAttendance,
    monthly: {
      attendance: monthlyAttendance,
      diplomaResults: monthlyDiplomaResults,
    },
    diplomaAnalysis: {
      bySemester,
      byYear,
      gpaDistribution: diplomaGPADistribution.map((g) => ({
        semesterName: g.semesterName,
        avgGpa: g._avg.gpa1 != null ? Math.round(g._avg.gpa1 * 100) / 100 : null,
        count: g._count.id,
      })),
      topReferredSubjects,
      topFailedSubjects,
    },
    recent: {
      notices: recentNotices,
      events: recentEvents,
    },
  };
};

// ─────────────────────────────────────────────────────────────
// Teacher Dashboard
// ─────────────────────────────────────────────────────────────

export const getTeacherDashboard = async (userId: number) => {
  const teacher = await prisma.teacher.findUnique({
    where: { userId, isDeleted: false },
    select: { id: true, departmentId: true },
  });

  if (!teacher) throw new ApiError(httpStatus.NOT_FOUND, "Teacher not found");

  const { id: teacherId, departmentId } = teacher;
  const months = getLast12Months();

  const [
    mySubjectGroups,
    totalStudentsTaught,
    totalSessionsTaken,
    myPracticals,
    myNotices,
    recentSessions,
    feedNotices,
    attendanceRecords,
  ] = await prisma.$transaction([
    prisma.subjectGroup.findMany({
      where: { teacherId, isDeleted: false },
      select: {
        id: true,
        subject: { select: { id: true, name: true, shortName: true, code: true } },
        group: { select: { id: true, name: true, session: true } },
        semester: { select: { id: true, name: true } },
        _count: { select: { practicals: true } },
      },
    }),
    prisma.student.count({
      where: {
        isDeleted: false,
        group: { subjectGroups: { some: { teacherId, isDeleted: false } } },
      },
    }),
    prisma.attendanceSession.count({ where: { teacherId, isDeleted: false } }),
    prisma.practical.findMany({
      where: { isDeleted: false, subjectGroup: { teacherId, isDeleted: false } },
      select: {
        id: true,
        title: true,
        type: true,
        totalMarks: true,
        submissionDeadline: true,
        givenDate: true,
        subjectGroup: {
          select: {
            subject: { select: { name: true, shortName: true } },
            group: { select: { name: true } },
            semester: { select: { name: true } },
          },
        },
        _count: { select: { submissions: true } },
        submissions: { select: { submitted: true, obtainedMarks: true } },
      },
    }),
    prisma.notice.findMany({
      where: { teacherId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        title: true,
        audienceType: true,
        priority: true,
        isPublished: true,
        createdAt: true,
        group: { select: { id: true, name: true } },
        student: { select: { id: true, name: true } },
      },
    }),
    prisma.attendanceSession.findMany({
      where: { teacherId, isDeleted: false },
      orderBy: { date: "desc" },
      take: 5,
      select: {
        id: true,
        date: true,
        subject: { select: { id: true, name: true } },
        group: { select: { id: true, name: true } },
        semester: { select: { id: true, name: true } },
        _count: { select: { records: true } },
      },
    }),
    prisma.notice.findMany({
      where: {
        isPublished: true,
        OR: [
          { audienceType: "ALL" },
          { audienceType: "TEACHER", teacherId },
          { audienceType: "DEPARTMENT", departmentId },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, title: true, audienceType: true, priority: true, createdAt: true },
    }),
    prisma.attendanceRecord.findMany({
      where: { session: { teacherId, isDeleted: false } },
      select: {
        status: true,
        session: { select: { subjectId: true, date: true } },
      },
    }),
  ]);

  // Monthly attendance
  const monthlySessions = await Promise.all(
    months.map(async (m) => {
      const [sessions, records] = await Promise.all([
        prisma.attendanceSession.count({
          where: { teacherId, isDeleted: false, date: { gte: m.start, lte: m.end } },
        }),
        prisma.attendanceRecord.groupBy({
          by: ["status"],
          where: { session: { teacherId, date: { gte: m.start, lte: m.end } } },
          orderBy: { status: "asc" }, // FIX
          _count: { id: true },
        }),
      ]);

      const present = records.find((r) => r.status === "PRESENT")?._count.id ?? 0;
      const absent = records.find((r) => r.status === "ABSENT")?._count.id ?? 0;
      const late = records.find((r) => r.status === "LATE")?._count.id ?? 0;
      const total = present + absent + late;

      return {
        label: m.label, year: m.year, month: m.month,
        sessions, present, absent, late, total,
        attendanceRate: total > 0 ? Math.round((present / total) * 100) : 0,
      };
    }),
  );

  // Monthly practicals
  const monthlyPracticals = await Promise.all(
    months.map(async (m) => {
      const [given, submitted] = await Promise.all([
        prisma.practical.count({
          where: { isDeleted: false, subjectGroup: { teacherId }, givenDate: { gte: m.start, lte: m.end } },
        }),
        prisma.practicalSubmission.count({
          where: { submitted: true, practical: { subjectGroup: { teacherId } }, updatedAt: { gte: m.start, lte: m.end } },
        }),
      ]);
      return { label: m.label, year: m.year, month: m.month, given, submitted };
    }),
  );

  // Per-subject attendance
  const subjectMap: Record<number, { name: string; present: number; absent: number; late: number }> = {};
  for (const rec of attendanceRecords) {
    const sid = rec.session.subjectId;
    if (!subjectMap[sid]) subjectMap[sid] = { name: "", present: 0, absent: 0, late: 0 };
    if (rec.status === "PRESENT") subjectMap[sid].present++;
    if (rec.status === "ABSENT") subjectMap[sid].absent++;
    if (rec.status === "LATE") subjectMap[sid].late++;
  }

  const subjectIds = Object.keys(subjectMap).map(Number);
  const subjectList = await prisma.subject.findMany({
    where: { id: { in: subjectIds } },
    select: { id: true, name: true, shortName: true },
  });

  const attendanceBySubject = subjectList.map((s) => {
    const data = subjectMap[s.id];
    const total = data.present + data.absent + data.late;
    return {
      subjectId: s.id, subjectName: s.name, subjectShort: s.shortName,
      present: data.present, absent: data.absent, late: data.late, total,
      attendanceRate: total > 0 ? Math.round((data.present / total) * 100) : 0,
    };
  });

  // Practical summary
  const practicalSummary = myPracticals.map((p) => {
    const totalSubmissions = p.submissions.length;
    const submitted = p.submissions.filter((s) => s.submitted).length;
    const avgMarks =
      submitted > 0
        ? Math.round(
            p.submissions
              .filter((s) => s.submitted && s.obtainedMarks !== null)
              .reduce((sum, s) => sum + (s.obtainedMarks ?? 0), 0) / submitted,
          )
        : 0;
    return {
      id: p.id, title: p.title, type: p.type, totalMarks: p.totalMarks,
      subject: p.subjectGroup.subject, group: p.subjectGroup.group, semester: p.subjectGroup.semester,
      submissionDeadline: p.submissionDeadline,
      totalStudents: totalSubmissions, submitted, pending: totalSubmissions - submitted,
      submissionRate: totalSubmissions > 0 ? Math.round((submitted / totalSubmissions) * 100) : 0,
      averageMarks: avgMarks,
    };
  });

  const totalAtt = attendanceRecords.length;
  const presentAtt = attendanceRecords.filter((r) => r.status === "PRESENT").length;

  return {
    overview: {
      totalSubjectGroups: mySubjectGroups.length,
      totalStudentsTaught,
      totalSessionsTaken,
      totalPracticals: myPracticals.length,
      totalNoticesCreated: myNotices.length,
      overallAttendanceRate: totalAtt > 0 ? Math.round((presentAtt / totalAtt) * 100) : 0,
    },
    subjectGroups: mySubjectGroups,
    attendanceBySubject,
    practicalSummary,
    monthly: { attendance: monthlySessions, practicals: monthlyPracticals },
    recentSessions,
    recent: { myNotices, feedNotices },
  };
};

// ─────────────────────────────────────────────────────────────
// Student Dashboard
// ─────────────────────────────────────────────────────────────

export const getStudentDashboard = async (userId: number) => {
  const student = await prisma.student.findUnique({
    where: { userId, isDeleted: false },
    select: {
      id: true, groupId: true, departmentId: true,
      group: { select: { currentSemesterId: true } },
    },
  });

  if (!student) throw new ApiError(httpStatus.NOT_FOUND, "Student not found");

  const { id: studentId, groupId, departmentId } = student;
  const semesterId = student.group?.currentSemesterId;
  const months = getLast12Months();

  const [
    totalSessions,
    attendanceSummaryRaw,
    practicalSubmissions,
    diplomaResults,
    myNotices,
    feedNotices,
    recentAttendance,
  ] = await prisma.$transaction([
    prisma.attendanceSession.count({ where: { groupId, semesterId, isDeleted: false } }),

    // FIX TS2345
    prisma.attendanceRecord.groupBy({
      by: ["status"],
      where: { studentId, session: { isDeleted: false } },
      orderBy: { status: "asc" }, // FIX
      _count: { id: true },
    }),

    prisma.practicalSubmission.findMany({
      where: { studentId },
      select: {
        id: true, submitted: true, obtainedMarks: true,
        practical: {
          select: {
            id: true, title: true, type: true, totalMarks: true,
            submissionDeadline: true, givenDate: true,
            subjectGroup: {
              select: {
                subject: { select: { id: true, name: true, shortName: true, code: true } },
                semester: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    }),

    prisma.diplomaResult.findMany({
      where: { studentId, isDeleted: false },
      orderBy: { semesterName: "asc" },
      select: {
        id: true, semesterName: true, examYear: true, status: true,
        gpa1: true, gpa2: true, gpa3: true, gpa4: true, gpa5: true, gpa6: true, gpa7: true,
        referredSubjects: true, failedSubjects: true,
      },
    }),

    prisma.notice.findMany({
      where: { studentId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true, title: true, audienceType: true, priority: true,
        isPublished: true, createdAt: true,
        group: { select: { id: true, name: true } },
      },
    }),

    prisma.notice.findMany({
      where: {
        isPublished: true,
        OR: [
          { audienceType: "ALL" },
          { audienceType: "STUDENT", studentId },
          { audienceType: "GROUP", groupId },
          { audienceType: "DEPARTMENT", departmentId },
          ...(semesterId ? [{ audienceType: "SEMESTER" as const, semesterId }] : []),
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, title: true, audienceType: true, priority: true, isPinned: true, createdAt: true },
    }),

    prisma.attendanceRecord.findMany({
      where: { studentId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true, status: true,
        session: {
          select: {
            date: true,
            subject: { select: { id: true, name: true, shortName: true } },
          },
        },
      },
    }),
  ]);

  // Monthly attendance
  const monthlyAttendance = await Promise.all(
    months.map(async (m) => {
      const records = await prisma.attendanceRecord.groupBy({
        by: ["status"],
        where: { studentId, session: { date: { gte: m.start, lte: m.end }, isDeleted: false } },
        orderBy: { status: "asc" }, // FIX
        _count: { id: true },
      });

      const present = records.find((r) => r.status === "PRESENT")?._count.id ?? 0;
      const absent = records.find((r) => r.status === "ABSENT")?._count.id ?? 0;
      const late = records.find((r) => r.status === "LATE")?._count.id ?? 0;
      const total = present + absent + late;

      return {
        label: m.label, year: m.year, month: m.month,
        present, absent, late, total,
        attendanceRate: total > 0 ? Math.round((present / total) * 100) : 0,
      };
    }),
  );

  // Monthly practicals
  const monthlyPracticals = await Promise.all(
    months.map(async (m) => {
      const [total, submitted] = await Promise.all([
        prisma.practicalSubmission.count({
          where: { studentId, practical: { givenDate: { gte: m.start, lte: m.end } } },
        }),
        prisma.practicalSubmission.count({
          where: { studentId, submitted: true, practical: { givenDate: { gte: m.start, lte: m.end } } },
        }),
      ]);
      return {
        label: m.label, year: m.year, month: m.month,
        total, submitted, pending: total - submitted,
        submissionRate: total > 0 ? Math.round((submitted / total) * 100) : 0,
      };
    }),
  );

  // Monthly marks
  const monthlyMarks = await Promise.all(
    months.map(async (m) => {
      const subs = await prisma.practicalSubmission.findMany({
        where: {
          studentId, submitted: true, obtainedMarks: { not: null },
          practical: { givenDate: { gte: m.start, lte: m.end } },
        },
        select: { obtainedMarks: true, practical: { select: { totalMarks: true } } },
      });

      const obtained = subs.reduce((s, p) => s + (p.obtainedMarks ?? 0), 0);
      const available = subs.reduce((s, p) => s + p.practical.totalMarks, 0);

      return {
        label: m.label, year: m.year, month: m.month,
        obtained, available,
        percentage: available > 0 ? Math.round((obtained / available) * 100) : 0,
      };
    }),
  );

  // Attendance summary
  // FIX TS2532 / TS2339 – use _count.id directly (typed correctly now that groupBy has orderBy)
  const present = attendanceSummaryRaw.find((r) => r.status === "PRESENT")?._count.id ?? 0;
  const absent = attendanceSummaryRaw.find((r) => r.status === "ABSENT")?._count.id ?? 0;
  const late = attendanceSummaryRaw.find((r) => r.status === "LATE")?._count.id ?? 0;
  const totalRecorded = present + absent + late;

  const attendanceSummary = {
    present, absent, late, totalSessions, totalRecorded,
    attendanceRate: totalSessions > 0 ? Math.round((present / totalSessions) * 100) : 0,
  };

  // Practical summary
  const totalAvail = practicalSubmissions.reduce((s, p) => s + p.practical.totalMarks, 0);
  const totalObt = practicalSubmissions.reduce((s, p) => s + (p.obtainedMarks ?? 0), 0);
  const practicalSummary = {
    total: practicalSubmissions.length,
    submitted: practicalSubmissions.filter((p) => p.submitted).length,
    pending: practicalSubmissions.filter((p) => !p.submitted).length,
    totalObtained: totalObt,
    totalAvailable: totalAvail,
    overallPercentage: totalAvail > 0 ? Math.round((totalObt / totalAvail) * 100) : 0,
  };

  // GPA trend
  const gpaTrend = diplomaResults.map((r) => {
    const gpas = [r.gpa1, r.gpa2, r.gpa3, r.gpa4, r.gpa5, r.gpa6, r.gpa7].filter(
      (g): g is number => g !== null && g !== undefined,
    );
    const avg =
      gpas.length > 0
        ? Math.round((gpas.reduce((s, g) => s + g, 0) / gpas.length) * 100) / 100
        : null;
    return {
      semesterName: r.semesterName, examYear: r.examYear, status: r.status,
      averageGpa: avg, referredSubjects: r.referredSubjects, failedSubjects: r.failedSubjects,
    };
  });

  // Per-subject attendance
  const attendanceBySubjectRaw = await prisma.attendanceRecord.findMany({
    where: { studentId },
    select: {
      status: true,
      session: { select: { subject: { select: { id: true, name: true, shortName: true } } } },
    },
  });

  const subjectBreakdown: Record<
    number,
    { subject: { id: number; name: string; shortName: string }; present: number; absent: number; late: number }
  > = {};

  for (const rec of attendanceBySubjectRaw) {
    const s = rec.session.subject;
    if (!subjectBreakdown[s.id])
      subjectBreakdown[s.id] = { subject: s, present: 0, absent: 0, late: 0 };
    if (rec.status === "PRESENT") subjectBreakdown[s.id].present++;
    if (rec.status === "ABSENT") subjectBreakdown[s.id].absent++;
    if (rec.status === "LATE") subjectBreakdown[s.id].late++;
  }

  const attendanceBySubject = Object.values(subjectBreakdown).map((s) => {
    const total = s.present + s.absent + s.late;
    return { ...s, total, attendanceRate: total > 0 ? Math.round((s.present / total) * 100) : 0 };
  });

  return {
    overview: {
      attendanceRate: attendanceSummary.attendanceRate,
      practicalScore: practicalSummary.overallPercentage,
      totalDiplomaResults: diplomaResults.length,
      latestGpa: gpaTrend.length > 0 ? gpaTrend[gpaTrend.length - 1].averageGpa : null,
      latestDiplomaStatus: gpaTrend.length > 0 ? gpaTrend[gpaTrend.length - 1].status : null,
    },
    attendance: { summary: attendanceSummary, bySubject: attendanceBySubject, recent: recentAttendance },
    practicals: { summary: practicalSummary, submissions: practicalSubmissions },
    diploma: { gpaTrend, results: diplomaResults },
    monthly: { attendance: monthlyAttendance, practicals: monthlyPracticals, marks: monthlyMarks },
    recent: { myNotices, feedNotices },
  };
};

export const dashboardService = {
  getAdminDashboard,
  getTeacherDashboard,
  getStudentDashboard,
};