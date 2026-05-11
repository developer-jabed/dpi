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
 *  PASSED (variable gpa fields depending on semester)
 *    634501 (gpa3: 3.50, gpa2: 3.25, gpa1: 3.10)
 *    634502 (gpa3: 3.10, gpa2:, gpa1: 2.95)                     ← gpa2 may be empty
 *    802810 (gpa4: 3.58, gpa3: 3.81, gpa2: 3.61, gpa1: 3.48)    ← 4th sem+
 *
 *  REFERRED with gpa fields
 *    800065 { gpa3: ref, gpa2: ref, gpa1: 3.07, ref_sub: 25921(T) }
 *    802810 { gpa4: 3.10, gpa3: ref, gpa2: 2.75, gpa1: 3.00, ref_sub: 66711(T) }
 *
 *  REFERRED without gpa (early semesters, fewer than 4 subjects failed)
 *    634503{25921(T)}
 *    634503 { 25921(T), 25931(T) }
 *
 *  FAILED (4 or more subjects failed in a single semester → dropout)
 *    634503 { 66711(T,P) 66712(P) 66713(T) 66714(T) }
 *
 * ─── Classification rule (no-gpa braced records) ─────────────────────────────
 *
 *  When a braced record has no gpa fields, subject codes are counted:
 *    • subject count >= 4  → DiplomaResultStatus.FAILED  (dropout)
 *    • subject count <  4  → DiplomaResultStatus.REFERRED
 *
 *  Records with gpa fields are always REFERRED regardless of subject count,
 *  because the board has already computed a cumulative GPA for them.
 *
 * ─── Root cause of the PASSED-skipping bug ───────────────────────────────────
 *
 *  pdf-parse frequently splits a single PASSED record across two physical lines:
 *
 *    Line 1: "802810"
 *    Line 2: "(gpa4: 3.58, gpa3: 3.81, gpa2: 3.61, gpa1: 3.48)"
 *
 *  OR:
 *    Line 1: "802810 (gpa4: 3.58,"
 *    Line 2: "gpa3: 3.81, gpa2: 3.61, gpa1: 3.48)"
 *
 *  The previous joinContinuationLines() only buffered open-BRACE `{` records.
 *  Open-PAREN `(` PASSED records were never buffered, so both halves were
 *  emitted as standalone lines that matched nothing and were silently dropped.
 *
 *  Fix: joinContinuationLines() now also buffers:
 *    1. A bare roll number (no paren, no brace) → expects `(gpa...)` on next line
 *    2. A roll + open paren with no closing paren → join until `)` appears
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
const DB_CHUNK_SIZE = 100;
const DB_CHUNK_CONCURRENCY = 10;

/**
 * Minimum number of failed subjects in a single semester to classify a student
 * as FAILED (dropout) rather than REFERRED.
 */
const DROPOUT_SUBJECT_THRESHOLD = 4;

const SEMESTER_LABEL: Readonly<Record<string, string>> = {
  '1': '1st', '2': '2nd', '3': '3rd', '4': '4th',
  '5': '5th', '6': '6th', '7': '7th', '8': '8th',
};

const GPA_LABELS = ['gpa7', 'gpa6', 'gpa5', 'gpa4', 'gpa3', 'gpa2', 'gpa1'] as const;
type GpaLabel = (typeof GPA_LABELS)[number];

// ─── Regex catalogue ──────────────────────────────────────────────────────────

const RE = {
  /** Strips "Page N of NNNN" pdf-parse artifact fused onto line start */
  pagePrefix: /^Page\s+\d+\s+of\s+\d+\s*/,

  /** "13085 - Dinajpur Polytechnic Institute" — never fires on data lines */
  instituteHeader: /^(\d{5})\s*-\s*(.+)$/,

  /** PASSED line: roll followed anywhere by "(gpaN:" */
  passedLine: /\d{5,7}\s*\(\s*gpa\d\s*:/,

  /**
   * PASSED record extractor.
   * `[^()]+` — no nested parens allowed inside the gpa block.
   * Gpa blocks never contain parens; subject codes like "(T)" do → clean separation.
   */
  passedRecord: /(\d{5,7})\s*\(([^()]+)\)/g,

  hasBrace: /[{}]/,

  /**
   * Open-brace without closing brace on same line.
   * Used to start buffering a split REFERRED/FAILED record.
   */
  openBrace: /^\d{5,7}\s*\{[^}]*$/,

  /**
   * Open-paren without closing paren on same line.
   * Used to start buffering a split PASSED record.
   * e.g. "802810 (gpa4: 3.58," — no ")" yet.
   */
  openParen: /^\d{5,7}\s*\([^)]*$/,

  /**
   * A bare roll number with nothing else on the line.
   * pdf-parse sometimes emits the roll and the gpa block on separate lines.
   * e.g. line1="802810"  line2="(gpa4: 3.58, gpa3: 3.81, gpa2: 3.61, gpa1: 3.48)"
   */
  bareRoll: /^\d{5,7}$/,

  bracedRecord: /^(\d{5,7})\s*\{(.+?)\}\s*$/,
  bracedLineGate: /^\d{5,7}\s*\{/,

  hasGpa: /gpa\d\s*:/,

  gpaField: (label: GpaLabel): RegExp =>
    new RegExp(`${label}\\s*:\\s*([\\d.]+|ref)`),

  refSub: /ref_sub:\s*(.+)/,
  subjectCode: /(\d{5})\([TP][^)]*\)/g,
  semesterNum: /\b([1-8])(?:st|nd|rd|th)\s+semester/i,
  examYear: /\b(20\d{2})\b/g,
  regulation: /\((\d{4})\s+Regulation\)/i,
} as const;

// ─── Value helpers ────────────────────────────────────────────────────────────

function toFloat(value: string | undefined): number | null {
  if (!value?.trim()) return null;
  const parsed = parseFloat(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function gpaOrNull(value: string | undefined): number | null {
  if (!value || value.trim() === 'ref') return null;
  return toFloat(value);
}

function extractGpaField(label: GpaLabel, content: string): number | null {
  const m = content.match(RE.gpaField(label));
  return m ? gpaOrNull(m[1]) : null;
}

function extractSubjectCodes(text: string): string[] {
  const re = new RegExp(RE.subjectCode.source, 'g');
  const matches: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    matches.push(m[1]);
  }
  return matches;
}

function stripPagePrefix(raw: string): string {
  return raw.replace(RE.pagePrefix, '').trim();
}

// ─── PDF text pre-processing ──────────────────────────────────────────────────

type BufferType = 'brace' | 'paren' | null;

/**
 * Joins continuation lines for both braced (REFERRED/FAILED) and
 * parenthetical (PASSED) records that pdf-parse splits across lines.
 *
 * Buffer types:
 *   'brace' — open `{` seen, accumulate until `}` appears
 *   'paren' — open `(` seen (or bare roll), accumulate until `)` appears
 *
 * This fixes the core bug: PASSED records for 4th+ semester students were
 * silently dropped because their lines were split and only braces were buffered.
 */
function joinContinuationLines(rawText: string): string[] {
  const lines: string[] = [];
  let buffer = '';
  let bufferType: BufferType = null;

  for (const raw of rawText.split('\n')) {
    const line = stripPagePrefix(raw);
    if (!line) continue;

    // ── Continuation: append to existing buffer ───────────────────────────
    if (buffer) {
      buffer += ' ' + line;
      const isClosed =
        bufferType === 'brace' ? buffer.includes('}') : buffer.includes(')');
      if (isClosed) {
        lines.push(buffer);
        buffer = '';
        bufferType = null;
      }
      continue;
    }

    // ── Start buffering: open brace, no close brace ───────────────────────
    if (RE.openBrace.test(line) && !line.includes('}')) {
      buffer = line;
      bufferType = 'brace';
      continue;
    }

    // ── Start buffering: open paren, no close paren ───────────────────────
    // Covers "802810 (gpa4: 3.58," split mid-record
    if (RE.openParen.test(line) && !line.includes(')')) {
      buffer = line;
      bufferType = 'paren';
      continue;
    }

    // ── Start buffering: bare roll number ─────────────────────────────────
    // Covers "802810" on one line, "(gpa4: 3.58, ...)" on the next
    if (RE.bareRoll.test(line)) {
      buffer = line;
      bufferType = 'paren';
      continue;
    }

    lines.push(line);
  }

  // Flush unclosed buffer (malformed / truncated record)
  if (buffer) lines.push(buffer);
  return lines;
}

// ─── Exam metadata extraction ─────────────────────────────────────────────────

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
 * Parses one or more PASSED records from a single (already-joined) line.
 */
function parsePassed(
  line: string,
  institute: InstituteRef,
  meta: ExamMeta,
): ParsedStudent[] {
  const students: ParsedStudent[] = [];
  const re = new RegExp(RE.passedRecord.source, 'g');
  let match: RegExpExecArray | null;

  while ((match = re.exec(line)) !== null) {
    const roll = match[1];
    const content = match[2];

    if (!RE.hasGpa.test(content)) {
      console.debug(`[Parser] Skipping non-gpa paren roll=${roll}: "${content}"`);
      continue;
    }

    const student: ParsedStudent = {
      roll,
      instituteCode: institute.code,
      instituteName: institute.name,
      semesterName: meta.semesterName,
      examYear: meta.examYear,
      regulation: meta.regulation,
      status: DiplomaResultStatus.PASSED,
      gpa1: extractGpaField('gpa1', content),
      gpa2: extractGpaField('gpa2', content),
      gpa3: extractGpaField('gpa3', content),
      gpa4: extractGpaField('gpa4', content),
      gpa5: extractGpaField('gpa5', content),
      gpa6: extractGpaField('gpa6', content),
      gpa7: extractGpaField('gpa7', content),
      referredSubjects: [],
      failedSubjects: [],
    };

    console.debug(
      `[Parser] PASSED roll=${roll} gpa4=${student.gpa4} gpa3=${student.gpa3} gpa2=${student.gpa2} gpa1=${student.gpa1}`,
    );

    students.push(student);
  }

  return students;
}

/**
 * Parses a single braced record — REFERRED (with or without gpa) or FAILED.
 *
 * Classification:
 *   1. Has gpa fields                          → REFERRED (cumulative gpa available)
 *   2. No gpa, subject count >= 4 (this sem)   → FAILED   (dropout threshold reached)
 *   3. No gpa, subject count 1–3               → REFERRED (back-paper, still enrolled)
 *   4. No gpa, no subject codes at all         → FAILED   (malformed / unrecognised)
 */
function parseBraced(
  line: string,
  institute: InstituteRef,
  meta: ExamMeta,
): ParsedStudent | null {
  const match = line.match(RE.bracedRecord);
  if (!match) return null;

  const roll = match[1];
  const content = match[2].trim();

  const base = {
    roll,
    instituteCode: institute.code,
    instituteName: institute.name,
    semesterName: meta.semesterName,
    examYear: meta.examYear,
    regulation: meta.regulation,
  } as const;

  const nullGpas = {
    gpa1: null, gpa2: null, gpa3: null, gpa4: null,
    gpa5: null, gpa6: null, gpa7: null,
  } as const;

  // ── Case 1: record has cumulative gpa fields → always REFERRED ────────────
  if (RE.hasGpa.test(content)) {
    const refSubRaw = content.match(RE.refSub)?.[1] ?? '';
    return {
      ...base,
      status: DiplomaResultStatus.REFERRED,
      gpa1: extractGpaField('gpa1', content),
      gpa2: extractGpaField('gpa2', content),
      gpa3: extractGpaField('gpa3', content),
      gpa4: extractGpaField('gpa4', content),
      gpa5: extractGpaField('gpa5', content),
      gpa6: extractGpaField('gpa6', content),
      gpa7: extractGpaField('gpa7', content),
      referredSubjects: extractSubjectCodes(refSubRaw),
      failedSubjects: [],
    };
  }

  const subjectCodes = extractSubjectCodes(content);

  if (subjectCodes.length > 0) {
    // ── Case 2: 4+ subjects failed in this single semester → dropout (FAILED) ─
    // ── Case 3: fewer than 4 subjects → back-paper candidate (REFERRED) ───────
    const isDropout = subjectCodes.length >= DROPOUT_SUBJECT_THRESHOLD;

    console.debug(
      `[Parser] ${isDropout ? 'FAILED' : 'REFERRED'} roll=${roll} subjects=${subjectCodes.length} codes=${subjectCodes.join(',')}`,
    );

    return {
      ...base,
      ...nullGpas,
      status: isDropout ? DiplomaResultStatus.FAILED : DiplomaResultStatus.REFERRED,
      referredSubjects: isDropout ? [] : subjectCodes,
      failedSubjects:   isDropout ? subjectCodes : [],
    };
  }

  // ── Case 4: no subject codes extracted — malformed record → FAILED ─────────
  return {
    ...base,
    ...nullGpas,
    status: DiplomaResultStatus.FAILED,
    referredSubjects: [],
    failedSubjects: [],
  };
}

// ─── Full-document processor ──────────────────────────────────────────────────

function processLines(lines: string[], meta: ExamMeta): ParsedStudent[] {
  const students: ParsedStudent[] = [];
  let institute: InstituteRef | null = null;
  let isTargetInstitute = false;

  for (const line of lines) {
    if (!line) continue;

    // ── Institute header ──────────────────────────────────────────────────
    const instituteMatch = line.match(RE.instituteHeader);
    if (
      instituteMatch &&
      !RE.hasBrace.test(line) &&
      !RE.hasGpa.test(line) &&
      !RE.passedLine.test(line)
    ) {
      institute = { code: instituteMatch[1], name: instituteMatch[2].trim() };
      isTargetInstitute = institute.code === TARGET_INSTITUTE_CODE;
      console.info(
        `[Parser] Institute: ${institute.code} "${institute.name}" | target=${isTargetInstitute}`,
      );
      continue;
    }

    if (!isTargetInstitute || !institute) continue;

    // ── PASSED ────────────────────────────────────────────────────────────
    if (RE.passedLine.test(line)) {
      const parsed = parsePassed(line, institute, meta);
      if (parsed.length > 0) {
        students.push(...parsed);
      } else {
        console.warn(`[Parser] PASSED line matched but no records extracted: "${line}"`);
      }
      continue;
    }

    // ── REFERRED / FAILED ─────────────────────────────────────────────────
    if (RE.bracedLineGate.test(line)) {
      const student = parseBraced(line, institute, meta);
      if (student) {
        students.push(student);
      } else {
        console.warn(`[Parser] Braced line did not parse: "${line}"`);
      }
    }
  }

  return students;
}

// ─── PDF extraction ───────────────────────────────────────────────────────────

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

  const passedCount   = students.filter((s) => s.status === DiplomaResultStatus.PASSED).length;
  const referredCount = students.filter((s) => s.status === DiplomaResultStatus.REFERRED).length;
  const failedCount   = students.filter((s) => s.status === DiplomaResultStatus.FAILED).length;

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

async function fetchStudentMap(rolls: string[]): Promise<Map<string, StudentLookup>> {
  if (!rolls.length) return new Map();

  const rows = await prisma.student.findMany({
    where: { roll: { in: rolls }, isDeleted: false },
    select: { id: true, roll: true, groupId: true },
  });

  return new Map(
    rows.map((row) => [row.roll, { studentId: row.id, groupId: row.groupId }]),
  );
}

async function fetchSemesterMap(): Promise<Map<string, number>> {
  const rows = await prisma.semester.findMany({
    where: { isDeleted: false },
    select: { id: true, name: true },
  });

  return new Map(rows.map((row) => [row.name, row.id]));
}

// ─── Upsert payload builder ───────────────────────────────────────────────────

type UpsertArgs = Parameters<typeof prisma.diplomaResult.upsert>[0];

function buildUpsertArgs(
  student: ParsedStudent,
  semesterId: number | undefined,
  lookup: StudentLookup | undefined,
): UpsertArgs {
  const semesterConnect    = semesterId !== undefined ? { connect: { id: semesterId } } : undefined;
  const semesterDisconnect = semesterId === undefined ? { disconnect: true as const } : undefined;
  const studentConnect     = lookup !== undefined ? { connect: { id: lookup.studentId } } : undefined;
  const groupConnect       = lookup !== undefined ? { connect: { id: lookup.groupId } } : undefined;

  const sharedFields = {
    status:          student.status,
    instituteCode:   student.instituteCode,
    instituteName:   student.instituteName,
    gpa1: student.gpa1, gpa2: student.gpa2, gpa3: student.gpa3,
    gpa4: student.gpa4, gpa5: student.gpa5, gpa6: student.gpa6,
    gpa7: student.gpa7,
    referredSubjects: student.referredSubjects,
    failedSubjects:   student.failedSubjects,
  };

  return {
    where: {
      roll_semesterName_examYear_regulation: {
        roll:         student.roll,
        semesterName: student.semesterName,
        examYear:     student.examYear,
        regulation:   student.regulation,
      },
    },
    create: {
      ...sharedFields,
      roll:         student.roll,
      semesterName: student.semesterName,
      examYear:     student.examYear,
      regulation:   student.regulation,
      ...(semesterConnect && { semester: semesterConnect }),
      ...(studentConnect  && { student:  studentConnect  }),
      ...(groupConnect    && { group:    groupConnect    }),
    },
    update: {
      ...sharedFields,
      semester: semesterConnect ?? semesterDisconnect!,
      ...(studentConnect && { student: studentConnect }),
      ...(groupConnect   && { group:   groupConnect   }),
    },
  };
}

// ─── Concurrent task runner ───────────────────────────────────────────────────

async function runWithConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  concurrency: number,
): Promise<T[]> {
  const results: T[] = [];
  for (let i = 0; i < tasks.length; i += concurrency) {
    const slice = tasks.slice(i, i + concurrency);
    const sliceResults = await Promise.all(slice.map((fn) => fn()));
    results.push(...sliceResults);
  }
  return results;
}

// ─── Persistence ──────────────────────────────────────────────────────────────

async function saveParsedResults(students: ParsedStudent[]): Promise<SaveResult> {
  if (!students.length) {
    return { savedCount: 0, linkedCount: 0, orphanCount: 0, skippedCount: 0, orphanRolls: [] };
  }

  const semesterMap = await fetchSemesterMap();

  let savedCount  = 0;
  let linkedCount = 0;
  let orphanCount = 0;
  const orphanRolls: string[] = [];

  const totalBatches = Math.ceil(students.length / DB_CHUNK_SIZE);

  for (let i = 0; i < students.length; i += DB_CHUNK_SIZE) {
    const batch       = students.slice(i, i + DB_CHUNK_SIZE);
    const batchNumber = Math.floor(i / DB_CHUNK_SIZE) + 1;

    const studentMap = await fetchStudentMap(batch.map((s) => s.roll));

    let batchLinked = 0;
    let batchOrphan = 0;

    const tasks = batch.map((student) => {
      const semesterId = semesterMap.get(student.semesterName);
      const lookup     = studentMap.get(student.roll);

      if (semesterId === undefined) {
        console.warn(
          `[DB] Semester "${student.semesterName}" not found — saved without semester link.`,
        );
      }

      if (lookup) {
        batchLinked++;
      } else {
        batchOrphan++;
        orphanRolls.push(student.roll);
      }

      return (): Promise<unknown> =>
        prisma.diplomaResult.upsert(buildUpsertArgs(student, semesterId, lookup));
    });

    await runWithConcurrency(tasks, DB_CHUNK_CONCURRENCY);

    savedCount  += batch.length;
    linkedCount += batchLinked;
    orphanCount += batchOrphan;

    console.info(
      `[DB] Batch ${batchNumber}/${totalBatches}: upserted=${batch.length} | linked=${batchLinked} | orphan=${batchOrphan}`,
    );
  }

  console.info(
    `[DB] Complete — savedCount=${savedCount} | linkedCount=${linkedCount} | orphanCount=${orphanCount}`,
  );

  if (orphanRolls.length) {
    const preview  = orphanRolls.slice(0, 20).join(', ');
    const overflow = orphanRolls.length > 20 ? `, and ${orphanRolls.length - 20} more` : '';
    console.warn(`[DB] Orphan rolls (no matching Student row): ${preview}${overflow}`);
  }

  return { savedCount, linkedCount, orphanCount, skippedCount: 0, orphanRolls };
}

export const resultParserService = {
  parsePDFBuffer,
  saveParsedResults,
} as const;