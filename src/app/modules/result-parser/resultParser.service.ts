/**
 * resultParser.service.ts
 *
 * BTEB (Bangladesh Technical Education Board) — Diploma Result Parser
 * Institute : Dinajpur Polytechnic Institute (code: 13085)
 *
 * Supported statuses : PASSED | REFERRED | FAILED
 * Save strategy      : upsert — create on first upload, update on re-upload
 *
 * ─── Real BTEB PDF record formats ────────────────────────────────────────────
 *
 *  PASSED
 *    634501 (gpa3: 3.50, gpa2: 3.25, gpa1: 3.10)
 *    634502 (gpa3: 3.10, gpa2:, gpa1: 2.95)         ← gpa2 may be empty
 *
 *  REFERRED  (gpa values may be the literal word "ref")
 *    800065 { gpa3: ref, gpa2: ref, gpa1: 3.07, ref_sub: 25921(T), 25931(T) }
 *    634502 { gpa3: 3.10, gpa2: 2.75, gpa1: 3.00, ref_sub: 66711(T) 66712(P) }
 *
 *  FAILED   (braces, NO gpa fields)
 *    634503 { 66711(T,P) 66712(P) }
 *
 * Subject-code type indicators
 *   (T)   = Theory referred/failed
 *   (P)   = Practical referred/failed
 *   (T,P) = Both referred/failed
 *
 * ─── Critical dispatcher rule ────────────────────────────────────────────────
 * DO NOT use /\d{5,7}\s*\(/ to detect PASSED lines.
 * REFERRED lines contain subject codes like 25921(T) which also match that
 * pattern and would be silently routed to parsePassed → dropped.
 *
 * Instead, detect PASSED by /\d{5,7}\s*\(gpa\d:/ — the literal "gpa" text
 * can only appear in a PASSED round-bracket record, never in subject codes.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { DiplomaResultStatus } from '@prisma/client';
import httpStatus from 'http-status';
import ApiError from '../../errors/api.error';
import { prisma } from '../../shared/prisma';
import type {
  ExamMeta,
  ParsedStudent,
  ParseResult,
  SaveResult,
} from './resultParser.interface';

// ─── Constants ────────────────────────────────────────────────────────────────

const TARGET_INSTITUTE_CODE = '13085' as const;

/** Students processed per DB batch */
const DB_CHUNK_SIZE = 100;

/** Concurrent upserts within one batch */
const DB_CHUNK_CONCURRENCY = 10;

/** Semester ordinal digit → normalized DB label */
const SEMESTER_LABEL: Readonly<Record<string, string>> = {
  '1': '1st',
  '2': '2nd',
  '3': '3rd',
  '4': '4th',
  '5': '5th',
  '6': '6th',
  '7': '7th',
  '8': '8th',
};

// ─── Regex catalogue ──────────────────────────────────────────────────────────

/**
 * All regexes are defined once and reused.
 * Stateful regexes (with /g flag) are cloned via `new RegExp(re.source, 'g')`
 * at call sites to avoid lastIndex carry-over across invocations.
 */
const RE = {
  /** PDF artifact: "Page 3 of 1226" fused onto the first token of a line */
  pagePrefix: /^Page\s+\d+\s+of\s+\d+\s*/,

  /** "13085 - Dinajpur Polytechnic Institute" */
  instituteHeader: /^(\d{5})\s*-\s*(.+)$/,

  /**
   * PASSED detector — safe against REFERRED lines.
   * Using /\d{5,7}\s*\(/ would also fire on subject codes like 25921(T).
   * The literal "gpa" text only appears in PASSED round-bracket records.
   */
  passedLine: /\d{5,7}\s*\(gpa\d:/,

  /**
   * PASSED full match — multiple records may appear on one line.
   * Groups: [1]=roll  [2]=gpa3  [3]=gpa2  [4]=gpa1
   */
  passedRecord:
    /(\d{5,7})\s*\(gpa3:\s*([\d.]*),\s*gpa2:\s*([\d.]*),\s*gpa1:\s*([\d.]*)\)/g,

  /** Braced record without closing brace — needs next-line continuation */
  openBrace: /^\d{5,7}\s*\{[^}]*$/,

  /**
   * Complete braced record (REFERRED or FAILED).
   * Groups: [1]=roll  [2]=content between braces
   */
  bracedRecord: /^(\d{5,7})\s*\{(.+)\}$/,

  /** Distinguishes REFERRED (has gpa fields) from FAILED (no gpa fields) */
  hasGpa: /gpa\d:/,

  gpa3: /gpa3:\s*([\d.]+|ref)/,
  gpa2: /gpa2:\s*([\d.]+|ref)/,
  gpa1: /gpa1:\s*([\d.]+|ref)/,

  /** Everything after "ref_sub:" up to end of braced content */
  refSub: /ref_sub:\s*(.+)/,

  /**
   * Subject code token: 5-digit code + type indicator.
   * Matches: 25921(T)  66712(P)  66713(T,P)
   */
  subjectCode: /\d{5}\([TP][^)]*\)/g,

  /** Semester ordinal in header, e.g. "3rd Semester" */
  semesterNum: /\b([1-8])(?:st|nd|rd|th)\s+semester/i,

  /** 4-digit year in range 2000–2100 */
  examYear: /\b(20\d{2})\b/g,

  /** "(2022 Regulation)" */
  regulation: /\((\d{4})\s+Regulation\)/i,
} as const;

// ─── Value helpers ────────────────────────────────────────────────────────────

/** Parses a numeric string to float; returns null for empty / NaN input. */
function toFloat(value: string | undefined): number | null {
  if (!value?.trim()) return null;
  const parsed = parseFloat(value);
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Returns null when BTEB uses the literal word "ref" for a withheld GPA,
 * or when the value is absent / unparseable.
 */
function gpaOrNull(value: string | undefined): number | null {
  if (!value || value.trim() === 'ref') return null;
  return toFloat(value);
}

/**
 * Extracts 5-digit subject codes from a ref_sub or failed-subjects string.
 *
 * Input  : "25921(T), 25931(T), 26133(T)"   ← comma-space separated
 *           "66711(T) 66712(P) 66713(T,P)"   ← space separated
 * Output : ["25921", "25931", "26133"]
 */
function extractSubjectCodes(text: string): string[] {
  const matches = text.match(RE.subjectCode) ?? [];
  return matches.map((token) => token.slice(0, 5));
}

/** Strips the "Page N of NNNN" artifact that pdf-parse fuses onto content lines. */
function stripPagePrefix(raw: string): string {
  return raw.replace(RE.pagePrefix, '').trim();
}

// ─── PDF text pre-processing ──────────────────────────────────────────────────

/**
 * Joins continuation lines for multi-line braced records.
 *
 * Some BTEB PDFs split a single `{ … }` record across two physical lines.
 * We accumulate lines into a buffer until we see a closing brace, then emit
 * the joined string as one logical line.
 */
function joinContinuationLines(rawText: string): string[] {
  const lines: string[] = [];
  let buffer = '';

  for (const raw of rawText.split('\n')) {
    const line = stripPagePrefix(raw);
    if (!line) continue;

    if (buffer) {
      buffer += ' ' + line;
      if (buffer.includes('}')) {
        lines.push(buffer);
        buffer = '';
      }
      continue;
    }

    if (RE.openBrace.test(line) && !line.includes('}')) {
      buffer = line;
      continue;
    }

    lines.push(line);
  }

  // Flush any unclosed buffer (malformed record)
  if (buffer) lines.push(buffer);

  return lines;
}

// ─── Exam metadata extraction ─────────────────────────────────────────────────

/**
 * Extracts semester, exam year, and regulation from the first ~4 KB of PDF text.
 * Falls back to safe defaults when a field is absent.
 */
function extractExamMeta(text: string): ExamMeta {
  const header = text.slice(0, 4_000);

  const semesterMatch = header.match(RE.semesterNum);
  const semesterDigit = semesterMatch?.[1] ?? '1';
  const semesterName = SEMESTER_LABEL[semesterDigit] ?? '1st';

  const yearMatches = [...header.matchAll(new RegExp(RE.examYear.source, 'g'))]
    .map((m) => parseInt(m[1], 10))
    .filter((y) => y >= 2000 && y <= 2100);
  const examYear = yearMatches.length
    ? Math.max(...yearMatches)
    : new Date().getFullYear();

  const regulation = header.match(RE.regulation)?.[1] ?? 'Unknown';

  console.info(
    `[Meta] semesterName="${semesterName}" | examYear=${examYear} | regulation="${regulation}"`,
  );

  return { semesterName, examYear, regulation };
}

// ─── Per-line record parsers ──────────────────────────────────────────────────

interface InstituteRef {
  code: string;
  name: string;
}

/**
 * Parses one or more PASSED records from a single line.
 * Multiple records can appear on the same line in BTEB PDFs.
 */
function parsePassed(
  line: string,
  institute: InstituteRef,
  meta: ExamMeta,
): ParsedStudent[] {
  const students: ParsedStudent[] = [];
  // Clone to reset lastIndex on each call — required for /g regexes
  const re = new RegExp(RE.passedRecord.source, 'g');
  let match: RegExpExecArray | null;

  while ((match = re.exec(line)) !== null) {
    students.push({
      roll: match[1],
      instituteCode: institute.code,
      instituteName: institute.name,
      semesterName: meta.semesterName,
      examYear: meta.examYear,
      regulation: meta.regulation,
      status: DiplomaResultStatus.PASSED,
      gpa3: toFloat(match[2]),
      gpa2: toFloat(match[3]),
      gpa1: toFloat(match[4]),
      gpa4: null,
      gpa5: null,
      gpa6: null,
      gpa7: null,
      referredSubjects: [],
      failedSubjects: [],
    });
  }

  return students;
}

/**
 * Parses a single braced record — either REFERRED or FAILED.
 * Returns null if the line does not match the braced record pattern.
 */
function parseBraced(
  line: string,
  institute: InstituteRef,
  meta: ExamMeta,
): ParsedStudent | null {
  const match = line.match(RE.bracedRecord);
  if (!match) return null;

  const roll = match[1];
  const content = match[2];

  const base = {
    roll,
    instituteCode: institute.code,
    instituteName: institute.name,
    semesterName: meta.semesterName,
    examYear: meta.examYear,
    regulation: meta.regulation,
    gpa4: null,
    gpa5: null,
    gpa6: null,
    gpa7: null,
  } as const;

  if (RE.hasGpa.test(content)) {
    // ── REFERRED ──────────────────────────────────────────────────────────
    const refSubRaw = content.match(RE.refSub)?.[1] ?? '';

    return {
      ...base,
      status: DiplomaResultStatus.REFERRED,
      gpa3: gpaOrNull(content.match(RE.gpa3)?.[1]),
      gpa2: gpaOrNull(content.match(RE.gpa2)?.[1]),
      gpa1: gpaOrNull(content.match(RE.gpa1)?.[1]),
      referredSubjects: extractSubjectCodes(refSubRaw),
      failedSubjects: [],
    };
  }

  // ── FAILED ────────────────────────────────────────────────────────────────
  return {
    ...base,
    status: DiplomaResultStatus.FAILED,
    gpa3: null,
    gpa2: null,
    gpa1: null,
    referredSubjects: [],
    failedSubjects: extractSubjectCodes(content),
  };
}

// ─── Full-document processor ──────────────────────────────────────────────────

/**
 * Iterates logical lines, tracks institute context, and dispatches each
 * record line to the correct parser.
 */
function processLines(lines: string[], meta: ExamMeta): ParsedStudent[] {
  const students: ParsedStudent[] = [];
  let institute: InstituteRef | null = null;
  let isTargetInstitute = false;

  for (const line of lines) {
    if (!line) continue;

    // ── Institute header ──────────────────────────────────────────────────
    // Exclude data lines that happen to contain "{" or "gpa" — they are
    // records, not headers.
    const instituteMatch = line.match(RE.instituteHeader);
    if (instituteMatch && !line.includes('{') && !RE.hasGpa.test(line)) {
      institute = { code: instituteMatch[1], name: instituteMatch[2].trim() };
      isTargetInstitute = institute.code === TARGET_INSTITUTE_CODE;
      console.info(
        `[Parser] Institute: ${institute.code} "${institute.name}" | target=${isTargetInstitute}`,
      );
      continue;
    }

    if (!isTargetInstitute || !institute) continue;

    // ── PASSED ─── safe detector: literal "gpa" in parens, never fires on subject codes
    if (RE.passedLine.test(line)) {
      students.push(...parsePassed(line, institute, meta));
      continue;
    }

    // ── REFERRED / FAILED ─── roll followed by braces
    if (/^\d{5,7}\s*\{/.test(line)) {
      const student = parseBraced(line, institute, meta);
      if (student) students.push(student);
    }
  }

  return students;
}

// ─── PDF extraction ───────────────────────────────────────────────────────────

/**
 * Extracts text from a PDF buffer, parses exam metadata and all student
 * records for the target institute.
 *
 * @throws ApiError (500) if pdf-parse fails
 * @throws ApiError (422) if the PDF contains no extractable text
 */
async function parsePDFBuffer(buffer: Buffer): Promise<ParseResult> {
  let rawText: string;

  try {
    const pdfParse = (await import('pdf-parse')).default;
    const result = await pdfParse(buffer);
    rawText = result.text;
  } catch (error) {
    console.error('[PDF] Text extraction failed:', error);
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'PDF text extraction failed. Ensure the file is a text-based PDF, not a scanned image.',
    );
  }

  if (!rawText?.trim()) {
    throw new ApiError(
      httpStatus.UNPROCESSABLE_ENTITY,
      'PDF contains no extractable text.',
    );
  }

  const meta = extractExamMeta(rawText);
  const lines = joinContinuationLines(rawText);
  const students = processLines(lines, meta);

  const passedCount = students.filter(
    (s) => s.status === DiplomaResultStatus.PASSED,
  ).length;
  const referredCount = students.filter(
    (s) => s.status === DiplomaResultStatus.REFERRED,
  ).length;
  const failedCount = students.filter(
    (s) => s.status === DiplomaResultStatus.FAILED,
  ).length;

  console.info(
    `[Parser] PASSED=${passedCount} | REFERRED=${referredCount} | FAILED=${failedCount} | TOTAL=${students.length}`,
  );

  if (!students.length) {
    console.warn(
      `[Parser] ⚠ No students found for institute ${TARGET_INSTITUTE_CODE}. ` +
        'Verify the institute code appears in this PDF.',
    );
  }

  return { meta, totalParsed: students.length, students };
}

// ─── DB lookup helpers ────────────────────────────────────────────────────────

interface StudentLookup {
  studentId: number;
  groupId: number;
}

/** Fetches all active students matching the given roll numbers. */
async function fetchStudentMap(
  rolls: string[],
): Promise<Map<string, StudentLookup>> {
  if (!rolls.length) return new Map();

  const rows = await prisma.student.findMany({
    where: { roll: { in: rolls }, isDeleted: false },
    select: { id: true, roll: true, groupId: true },
  });

  return new Map(
    rows.map((row) => [row.roll, { studentId: row.id, groupId: row.groupId }]),
  );
}

/** Fetches all active semesters, keyed by their name (e.g. "3rd"). */
async function fetchSemesterMap(): Promise<Map<string, number>> {
  const rows = await prisma.semester.findMany({
    where: { isDeleted: false },
    select: { id: true, name: true },
  });

  return new Map(rows.map((row) => [row.name, row.id]));
}

// ─── Upsert payload builder ───────────────────────────────────────────────────

type UpsertArgs = Parameters<typeof prisma.diplomaResult.upsert>[0];

/**
 * Builds the Prisma upsert payload for a single student result.
 *
 * Identity fields (roll, semesterName, examYear, regulation) form the unique
 * key and are never updated after creation.
 *
 * Semester relation: connected when found, disconnected on re-upload if the
 * semester row has since been removed.
 */
function buildUpsertArgs(
  student: ParsedStudent,
  semesterId: number | undefined,
  lookup: StudentLookup | undefined,
): UpsertArgs {
  const semesterConnect = semesterId !== undefined
    ? { connect: { id: semesterId } }
    : undefined;

  const semesterDisconnect = semesterId === undefined
    ? { disconnect: true as const }
    : undefined;

  const studentConnect = lookup !== undefined
    ? { connect: { id: lookup.studentId } }
    : undefined;

  const groupConnect = lookup !== undefined
    ? { connect: { id: lookup.groupId } }
    : undefined;

  const sharedFields = {
    status: student.status,
    instituteCode: student.instituteCode,
    instituteName: student.instituteName,
    gpa1: student.gpa1,
    gpa2: student.gpa2,
    gpa3: student.gpa3,
    gpa4: student.gpa4,
    gpa5: student.gpa5,
    gpa6: student.gpa6,
    gpa7: student.gpa7,
    referredSubjects: student.referredSubjects,
    failedSubjects: student.failedSubjects,
  };

  return {
    where: {
      roll_semesterName_examYear_regulation: {
        roll: student.roll,
        semesterName: student.semesterName,
        examYear: student.examYear,
        regulation: student.regulation,
      },
    },

    create: {
      ...sharedFields,
      roll: student.roll,
      semesterName: student.semesterName,
      examYear: student.examYear,
      regulation: student.regulation,
      ...(semesterConnect && { semester: semesterConnect }),
      ...(studentConnect && { student: studentConnect }),
      ...(groupConnect && { group: groupConnect }),
    },

    update: {
      ...sharedFields,
      // Reconnect semester in case it was added after initial upload
      semester: semesterConnect ?? semesterDisconnect!,
      // Reconnect student/group if the Student row was created after upload
      ...(studentConnect && { student: studentConnect }),
      ...(groupConnect && { group: groupConnect }),
    },
  };
}

// ─── Concurrent task runner ───────────────────────────────────────────────────

/**
 * Runs an array of async tasks with bounded concurrency.
 * Errors from individual tasks propagate and abort the current window.
 */
async function runWithConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  concurrency: number,
): Promise<T[]> {
  const results: T[] = [];

  for (let i = 0; i < tasks.length; i += concurrency) {
    const window = tasks.slice(i, i + concurrency);
    const windowResults = await Promise.all(window.map((fn) => fn()));
    results.push(...windowResults);
  }

  return results;
}

// ─── Persistence ──────────────────────────────────────────────────────────────

/**
 * Persists all parsed students via individual upserts in parallel batches.
 *
 * WHY NOT prisma.createMany:
 *   `skipDuplicates` silently drops records on conflict — re-uploads do not
 *   update changed data (status, gpa, referredSubjects, etc.).
 *
 * WHY NOT one giant $transaction:
 *   Holding a single transaction for 500+ upserts reliably exceeds Prisma's
 *   interactive-transaction timeout (P2028) on large PDFs.
 *
 * Each upsert is its own implicit atomic statement. If the process crashes
 * mid-upload, simply re-upload — the upsert strategy fills the gaps.
 */
async function saveParsedResults(
  students: ParsedStudent[],
): Promise<SaveResult> {
  if (!students.length) {
    return {
      savedCount: 0,
      linkedCount: 0,
      orphanCount: 0,
      skippedCount: 0,
      orphanRolls: [],
    };
  }

  const semesterMap = await fetchSemesterMap();

  let savedCount = 0;
  let linkedCount = 0;
  let orphanCount = 0;
  const orphanRolls: string[] = [];

  const totalBatches = Math.ceil(students.length / DB_CHUNK_SIZE);

  for (let i = 0; i < students.length; i += DB_CHUNK_SIZE) {
    const batch = students.slice(i, i + DB_CHUNK_SIZE);
    const batchNumber = Math.floor(i / DB_CHUNK_SIZE) + 1;

    // One DB round-trip per batch to look up Student rows
    const studentMap = await fetchStudentMap(batch.map((s) => s.roll));

    let batchLinked = 0;
    let batchOrphan = 0;

    const tasks = batch.map((student) => {
      const semesterId = semesterMap.get(student.semesterName);
      const lookup = studentMap.get(student.roll);

      if (semesterId === undefined) {
        console.warn(
          `[DB] Semester "${student.semesterName}" not found. ` +
            `Add a Semester row with name="${student.semesterName}" to enable linking.`,
        );
      }

      if (lookup) {
        batchLinked++;
      } else {
        batchOrphan++;
        orphanRolls.push(student.roll);
      }

      return (): Promise<unknown> =>
        prisma.diplomaResult.upsert(
          buildUpsertArgs(student, semesterId, lookup),
        );
    });

    await runWithConcurrency(tasks, DB_CHUNK_CONCURRENCY);

    savedCount += batch.length;
    linkedCount += batchLinked;
    orphanCount += batchOrphan;

    console.info(
      `[DB] Batch ${batchNumber}/${totalBatches}: ` +
        `upserted=${batch.length} | linked=${batchLinked} | orphan=${batchOrphan}`,
    );
  }

  console.info(
    `[DB] Complete — savedCount=${savedCount} | linkedCount=${linkedCount} | orphanCount=${orphanCount}`,
  );

  if (orphanRolls.length) {
    const preview = orphanRolls.slice(0, 20).join(', ');
    const overflow =
      orphanRolls.length > 20 ? `, and ${orphanRolls.length - 20} more` : '';
    console.warn(
      `[DB] Orphan rolls (no matching Student row): ${preview}${overflow}`,
    );
  }
  return{
  savedCount,
  linkedCount,
  orphanCount,
  skippedCount: 0, // No records are skipped in this implementation
  orphanRolls,
}
}

export const resultParserService = {
  parsePDFBuffer,
  saveParsedResults,
} as const;
