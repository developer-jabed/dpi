import httpStatus from "http-status";
import ApiError from "../../errors/api.error";
import chromium from "@sparticuz/chromium";
import puppeteerCore, { type Browser } from "puppeteer-core";
import { PDFDocument } from "pdf-lib";
import { prisma } from "../../shared/prisma";
import { Prisma, DiplomaResultStatus, SubjectResultType } from "@prisma/client";

// ── TYPES ────────────────────────────────────────────────────
/** One resolved subject entry for a result — code + real name + semester, not a bare code. */
interface ResolvedSubject {
  code: string;
  name: string;
  semesterName: string | null;
  type: SubjectResultType;
}

// ── HELPERS ──────────────────────────────────────────────────
function statusBadge(status: string): string {
  const styles: Record<string, string> = {
    PASSED: "background:#d1fae5;color:#065f46",
    FAILED: "background:#fee2e2;color:#991b1b",
    REFERRED: "background:#fef3c7;color:#92400e",
    WITHHELD: "background:#e5e7eb;color:#374151",
  };
  const label = status.charAt(0) + status.slice(1).toLowerCase();
  return `<span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:8px;font-weight:700;${styles[status] ?? ""}">${label}</span>`;
}

/** Chip now shows code + resolved subject name */
function chip(subject: ResolvedSubject): string {
  const fail = subject.type === "FAILED";
  const bg = fail ? "#fee2e2" : "#fef3c7";
  const border = fail ? "#fca5a5" : "#fde68a";
  const color = fail ? "#991b1b" : "#78350f";
  return `<span style="display:inline-flex;align-items:center;gap:3px;background:${bg};border:1px solid ${border};color:${color};padding:1px 5px;border-radius:3px;font-size:7.5px;font-weight:600;margin:1px">
    <span style="font-family:monospace">${subject.code}</span>
    <span style="font-weight:500">${subject.name}</span>
  </span>`;
}

/** Your rule: 0 → PASSED, 1-3 → REFERRED, 4+ → FAILED */
function computeStatus(
  referred: unknown[],
  failed: unknown[]
): DiplomaResultStatus {
  const totalBad = (referred?.length ?? 0) + (failed?.length ?? 0);
  if (totalBad === 0) return "PASSED";
  if (totalBad <= 3) return "REFERRED";
  return "FAILED";
}

/** Get GPA of the target semester only */
function currentSemesterGpa(
  r: {
    gpa1: number | null;
    gpa2: number | null;
    gpa3: number | null;
    gpa4: number | null;
    gpa5: number | null;
    gpa6: number | null;
    gpa7: number | null;
  },
  semesterOrder: number | null
): string {
  if (!semesterOrder || semesterOrder < 1 || semesterOrder > 7) return "—";
  const key = `gpa${semesterOrder}` as keyof typeof r;
  const val = r[key];
  if (val === null || val === undefined) return "—";
  const color = val >= 3 ? "#166534" : val >= 2 ? "#92400e" : "#991b1b";
  return `<span style="font-weight:700;color:${color}">${Number(val).toFixed(2)}</span>`;
}

// ── HTML BUILDER ─────────────────────────────────────────────
function buildDiplomaReportHtml(params: {
  group: {
    id: number;
    name: string;
    session: string;
    department: { shortName: string } | null;
    shift: { name: string } | null;
    currentSemester: { name: string; order: number } | null;
  };
  results: Array<{
    id: number;
    roll: string;
    examYear: number;
    status: string;
    gpa1: number | null;
    gpa2: number | null;
    gpa3: number | null;
    gpa4: number | null;
    gpa5: number | null;
    gpa6: number | null;
    gpa7: number | null;
    student: { name: string } | null;
    // Only subjects that belong to the target (running) semester
    subjectBreakdown: ResolvedSubject[];
  }>;
}): string {
  const { group, results } = params;

  // Recalculate status with your rule, based ONLY on the filtered (running-semester) breakdown
  const normalized = results.map((r) => {
    const referred = r.subjectBreakdown.filter((s) => s.type === "REFERRED");
    const failed = r.subjectBreakdown.filter((s) => s.type === "FAILED");
    return {
      ...r,
      referredList: referred,
      failedList: failed,
      status: computeStatus(referred, failed),
    };
  });

  const total = normalized.length;
  const passCount = normalized.filter((r) => r.status === "PASSED").length;
  const failCount = normalized.filter((r) => r.status === "FAILED").length;
  const referCount = normalized.filter((r) => r.status === "REFERRED").length;
  const passRate = total > 0 ? Math.round((passCount / total) * 100) : 0;

  const displaySem = group.currentSemester?.name ?? "—";
  const semOrder = group.currentSemester?.order ?? null;
  const displayYear = normalized[0]?.examYear ?? "—";

  const printDate = new Date().toLocaleString("en-BD", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Asia/Dhaka",
  });

  const resultRows =
    normalized.length === 0
      ? `<tr><td colspan="7" style="text-align:center;color:#9ca3af;padding:40px">No results found for this semester</td></tr>`
      : normalized
          .map((r, i) => {
            const name = r.student?.name ?? "—";
            const refChips = r.referredList.map((s) => chip(s)).join("");
            const failChips = r.failedList.map((s) => chip(s)).join("");
            const subjectsCell =
              refChips || failChips
                ? `${failChips}${refChips}`
                : `<span style="color:#9ca3af">—</span>`;

            return `
          <tr style="background:${i % 2 === 0 ? "#fff" : "#f8faf7"}">
            <td style="padding:6px 8px;border:1px solid #cfe0d8;text-align:center;color:#6b7280;font-size:9px">${i + 1}</td>
            <td style="padding:6px 8px;border:1px solid #cfe0d8;font-weight:600;font-size:10px">${name}</td>
            <td style="padding:6px 8px;border:1px solid #cfe0d8;font-family:monospace;font-size:9.5px">${r.roll}</td>
            <td style="padding:6px 8px;border:1px solid #cfe0d8;text-align:center">${currentSemesterGpa(r, semOrder)}</td>
            <td style="padding:6px 8px;border:1px solid #cfe0d8;text-align:center">${statusBadge(r.status)}</td>
            <td style="padding:6px 8px;border:1px solid #cfe0d8;font-size:9px">${subjectsCell}</td>
            <td style="padding:6px 8px;border:1px solid #cfe0d8;text-align:center;font-size:9px">${r.referredList.length + r.failedList.length}</td>
          </tr>`;
          })
          .join("");

  // Subject-wise summary — only subjects that belong to the target semester
  const subjectCount: Record<
    string,
    { code: string; name: string; semesterName: string | null; ref: number; fail: number }
  > = {};
  normalized.forEach((r) => {
    r.referredList.forEach((s) => {
      subjectCount[s.code] ??= {
        code: s.code,
        name: s.name,
        semesterName: s.semesterName,
        ref: 0,
        fail: 0,
      };
      subjectCount[s.code].ref++;
    });
    r.failedList.forEach((s) => {
      subjectCount[s.code] ??= {
        code: s.code,
        name: s.name,
        semesterName: s.semesterName,
        ref: 0,
        fail: 0,
      };
      subjectCount[s.code].fail++;
    });
  });

  const subjectRows = Object.values(subjectCount)
    .sort((a, b) => b.ref + b.fail - (a.ref + a.fail))
    .map(
      (s, i) => `
      <tr style="background:${i % 2 === 0 ? "#fffbeb" : "#fff"}">
        <td style="padding:5px 8px;border:1px solid #fde68a;text-align:center;color:#9ca3af;font-size:9px">${i + 1}</td>
        <td style="padding:5px 8px;border:1px solid #fde68a;font-family:monospace;font-weight:700;color:#92400e">${s.code}</td>
        <td style="padding:5px 8px;border:1px solid #fde68a;font-size:9.5px">${s.name}</td>
        <td style="padding:5px 8px;border:1px solid #fde68a;text-align:center;font-size:9px">${s.semesterName ?? "—"}</td>
        <td style="padding:5px 8px;border:1px solid #fde68a;text-align:center">${s.ref || "—"}</td>
        <td style="padding:5px 8px;border:1px solid #fde68a;text-align:center">${s.fail || "—"}</td>
        <td style="padding:5px 8px;border:1px solid #fde68a;text-align:center;font-weight:700">${s.ref + s.fail}</td>
        <td style="padding:5px 8px;border:1px solid #fde68a;text-align:center">${total > 0 ? (((s.ref + s.fail) / total) * 100).toFixed(1) : 0}%</td>
      </tr>`
    )
    .join("");

  const subjectSection = subjectRows
    ? `
    <div style="margin:30px 0 10px;font-family:Georgia,'Times New Roman',serif;font-size:12px;font-weight:700;color:#006A4E;border-left:4px solid #006A4E;padding-left:12px;">
      Subject-wise Referred / Failed Analysis — ${displaySem} Semester
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:9.5px;">
      <thead>
        <tr style="background:#fef3c7">
          <th style="padding:6px;border:1px solid #fde68a">Sl.</th>
          <th style="padding:6px;border:1px solid #fde68a;text-align:left">Code</th>
          <th style="padding:6px;border:1px solid #fde68a;text-align:left">Subject Name</th>
          <th style="padding:6px;border:1px solid #fde68a">Semester</th>
          <th style="padding:6px;border:1px solid #fde68a">Referred</th>
          <th style="padding:6px;border:1px solid #fde68a">Failed</th>
          <th style="padding:6px;border:1px solid #fde68a">Total</th>
          <th style="padding:6px;border:1px solid #fde68a">% of Class</th>
        </tr>
      </thead>
      <tbody>${subjectRows}</tbody>
    </table>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body {
      font-family: Arial, 'Segoe UI', sans-serif;
      font-size: 11px;
      color: #1a1a2e;
      background: #fff;
      line-height: 1.5;
    }
    .page {
      width: 210mm;
      min-height: 297mm;
      padding: 15mm 14mm;
      margin: 0 auto;
      background: white;
      position: relative;
      page-break-after: always;
    }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #cfe0d8; padding: 6px 5px; vertical-align: middle; }
    thead { display: table-header-group; }
    tr { break-inside: avoid; }
  </style>
</head>
<body>
  <div class="page">
    <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-35deg);font-size:88px;font-weight:900;color:rgba(0,106,78,0.06);font-family:Georgia,serif;pointer-events:none;z-index:0">OFFICIAL</div>
    <div style="position:relative;z-index:1">
      <div style="text-align:right;font-size:8.5px;color:#6b7280;margin-bottom:12px">Generated: ${printDate}</div>
      <div style="text-align:center;margin-bottom:20px">
        <div style="font-family:Georgia,serif;font-size:22px;font-weight:700;color:#006A4E">Dinajpur Polytechnic Institute</div>
        <div style="font-size:12px;color:#333;margin-top:4px">Department of Computer Science and Technology</div>
      </div>
      <div style="background:#006A4E;color:white;text-align:center;font-size:15px;font-weight:700;padding:10px 0;margin-bottom:18px">
        Diploma in Engineering — Result Analysis Report
      </div>
      <div style="background:#f8f9f7;padding:14px;border:1px solid #d1d5db;border-radius:4px;margin-bottom:20px;font-size:10.5px">
        <table style="width:100%;border:none">
          <tr>
            <td style="padding:4px 0"><strong>Group</strong></td>
            <td style="padding:4px 0">: ${group.name}</td>
            <td style="padding:4px 0"><strong>Session</strong></td>
            <td style="padding:4px 0">: ${group.session}</td>
          </tr>
          <tr>
            <td style="padding:4px 0"><strong>Semester</strong></td>
            <td style="padding:4px 0">: ${displaySem}</td>
            <td style="padding:4px 0"><strong>Shift</strong></td>
            <td style="padding:4px 0">: ${group.shift?.name ?? "—"}</td>
          </tr>
          <tr>
            <td style="padding:4px 0"><strong>Exam Year</strong></td>
            <td style="padding:4px 0">: ${displayYear}</td>
            <td style="padding:4px 0"><strong>Department</strong></td>
            <td style="padding:4px 0">: ${group.department?.shortName || "CST"}</td>
          </tr>
        </table>
      </div>
      <div style="margin-bottom:22px;font-size:10.5px">
        <strong>Total Students:</strong> ${total} &nbsp;&nbsp;&nbsp;
        <strong>Passed:</strong> ${passCount} &nbsp;&nbsp;&nbsp;
        <strong>Failed:</strong> ${failCount} &nbsp;&nbsp;&nbsp;
        <strong>Referred:</strong> ${referCount} &nbsp;&nbsp;&nbsp;
        <strong>Pass Rate:</strong> ${passRate}%
      </div>
      <div style="margin-bottom:25px">
        <div style="font-family:Georgia,serif;font-size:12.5px;font-weight:700;color:#006A4E;margin-bottom:10px;border-left:4px solid #006A4E;padding-left:12px;">
          Student-wise Result Details — ${displaySem} Semester
        </div>
        <table style="font-size:9.5px">
          <thead>
            <tr style="background:#006A4E;color:white">
              <th style="width:28px">Sl.</th>
              <th style="text-align:left">Name</th>
              <th style="width:80px">Roll</th>
              <th style="width:55px">GPA</th>
              <th style="width:70px">Status</th>
              <th>Ref / Fail Subjects</th>
              <th style="width:45px">Count</th>
            </tr>
          </thead>
          <tbody>${resultRows}</tbody>
        </table>
      </div>
      ${subjectSection}
      <div style="height: 70px;"></div>
      <div style="border-top:2px solid #006A4E;padding-top:25px;display:flex;justify-content:space-between;font-size:10.5px;color:#333">
        <div style="text-align:center">
          <div style="width:160px;border-top:1px solid #1f2937;margin:0 auto 10px"></div>
          Class Teacher<br><small style="color:#666">Department of CST</small>
        </div>
        <div style="text-align:center">
          Dinajpur Polytechnic Institute<br><small style="color:#777">Computer Generated Official Document</small>
        </div>
        <div style="text-align:center">
          <div style="width:160px;border-top:1px solid #1f2937;margin:0 auto 10px"></div>
          Head of Department<br><small style="color:#666">Computer Science &amp; Technology</small>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

// ── BROWSER LAUNCH ───────────────────────────────────────────
async function launchBrowser(): Promise<Browser> {
  const isProd = process.env.NODE_ENV === "production";

  if (isProd) {
    return puppeteerCore.launch({
      args: [
        ...chromium.args,
        "--disable-gpu",
        "--disable-dev-shm-usage",
        "--single-process",
        "--no-zygote",
      ],
      executablePath: await chromium.executablePath(),
      headless: true,
      defaultViewport: { width: 1240, height: 1754 },
    }) as Promise<Browser>;
  }

  return puppeteerCore.launch({
    executablePath:
      process.env.CHROME_PATH ||
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
  }) as Promise<Browser>;
}

// ── MAIN FUNCTION ────────────────────────────────────────────
const generateDiplomaReportPdf = async (groupId: number) => {
  // 1. Load group + current semester
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: {
      department: { select: { shortName: true } },
      shift: { select: { name: true } },
      currentSemester: { select: { id: true, name: true, order: true } },
    },
  });

  if (!group || group.isDeleted) {
    throw new ApiError(httpStatus.NOT_FOUND, "Group not found");
  }

  if (!group.currentSemesterId || !group.currentSemester) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Group has no current semester set");
  }

  // 2. Find the PREVIOUS semester (current order - 1)
  //    Group in 5th → show 4th
  //    Group in 6th → show 5th
  const previousOrder = group.currentSemester.order - 1;

  if (previousOrder < 1) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "No previous semester available (group is in 1st semester)"
    );
  }

  const previousSemester = await prisma.semester.findFirst({
    where: {
      order: previousOrder,
      isDeleted: false,
    },
  });

  if (!previousSemester) {
    throw new ApiError(
      httpStatus.NOT_FOUND,
      `Previous semester (order ${previousOrder}) not found in database`
    );
  }

  console.log(
    `[generateDiplomaReportPdf] Group is in ${group.currentSemester.name} → showing results of ${previousSemester.name}`
  );

  // 3. Query results of the PREVIOUS semester
  const where: Prisma.DiplomaResultWhereInput = {
    groupId: group.id,
    isDeleted: false,
    OR: [
      // Match by foreign key
      { semesterId: previousSemester.id },

      // Fallback when semesterId is null
      {
        semesterId: null,
        OR: [
          { semesterName: previousSemester.name },
          { semesterName: String(previousOrder) },
          { semesterName: `${previousOrder}th` },
          { semesterName: `${previousOrder}st` },
          { semesterName: `${previousOrder}nd` },
          { semesterName: `${previousOrder}rd` },
          {
            semesterName: {
              contains: String(previousOrder),
              mode: "insensitive",
            },
          },
        ],
      },
    ],
  };

  const rawResults = await prisma.diplomaResult.findMany({
    where,
    include: {
      student: { select: { name: true } },
      subjectBreakdown: {
        select: {
          type: true,
          subjectCode: true,
          subject: {
            select: {
              code: true,
              name: true,
              // ← we now also fetch semester id so we can filter strictly
              semester: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
    orderBy: { roll: "asc" },
  });

  // 4. Flatten + FILTER: keep ONLY subjects that belong to the target (previous) semester.
  //    Orphan codes (subject = null) are dropped because we cannot verify the semester.
  const results = rawResults.map((r) => ({
    ...r,
    subjectBreakdown: r.subjectBreakdown
      .filter((row) => {
        // Must have a linked Subject and that Subject must belong to the running/target semester
        return row.subject?.semester?.id === previousSemester.id;
      })
      .map(
        (row): ResolvedSubject => ({
          code: row.subject!.code, // safe because of the filter above
          name: row.subject!.name,
          semesterName: row.subject!.semester?.name ?? null,
          type: row.type,
        })
      ),
  }));

  console.log(
    `[generateDiplomaReportPdf] Found ${results.length} results for ${previousSemester.name} semester (subjects filtered to that semester only)`
  );

  // 5. Build HTML (pass previous semester so PDF shows correct name)
  const html = buildDiplomaReportHtml({
    group: {
      ...group,
      currentSemester: {
        name: previousSemester.name,
        order: previousSemester.order,
      },
    },
    results,
  });

  // 6. Generate PDF
  let browser: Browser | undefined;
  try {
    browser = await Promise.race([
      launchBrowser(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Browser launch timed out")), 20000)
      ),
    ]);

    const page = await browser.newPage();

    await page.setRequestInterception(true);
    page.on("request", (req) => {
      if (["image", "media", "font"].includes(req.resourceType())) {
        req.abort();
      } else {
        req.continue();
      }
    });

    await page.setContent(html, { waitUntil: "load", timeout: 15000 });
    await new Promise((resolve) => setTimeout(resolve, 300));

    const rawPdfBytes = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "15mm", right: "14mm", bottom: "20mm", left: "14mm" },
      preferCSSPageSize: true,
    });

    const pdfDoc = await PDFDocument.load(rawPdfBytes);
    pdfDoc.setTitle(`Diploma Result Report - Group ${group.name}`);
    pdfDoc.setSubject(`${previousSemester.name} Semester Result Analysis`);
    pdfDoc.setProducer("DPI Result System");
    pdfDoc.setCreationDate(new Date());

    const finalPdfBytes = await pdfDoc.save();

    const semLabel = previousSemester.name.replace(/\s+/g, "-");
    const filename = `DPI-CST-Group${group.name}-${semLabel}-${group.session}.pdf`;

    return { pdfBuffer: Buffer.from(finalPdfBytes), filename };
  } catch (err) {
    console.error("[generateDiplomaReportPdf]", err);
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      err instanceof Error ? err.message : "PDF generation failed"
    );
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
};

export const groupResultPdfService = {
  generateDiplomaReportPdf,
};