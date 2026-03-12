// resultParser.service.ts

import { Prisma } from '@prisma/client';
import httpStatus from 'http-status';
import ApiError from '../../errors/api.error';
import { prisma } from '../../shared/prisma';
import {
  ExamMeta,
  ParsedStudent,
  ParseResult,
  SaveResult,
  Semester,
} from './resultParser.interface';

// ─── Constants ───────────────────────────────────────────────────────────────

const BATCH_SIZE = 500;
const TARGET_INSTITUTE_CODE = '13085';

const SEMESTER_MAP: Record<string, Semester> = {
  '1': '1st', '2': '2nd', '3': '3rd',
  '4': '4th', '5': '5th', '6': '6th', '7': '7th',
};

// ─── Regex ────────────────────────────────────────────────────────────────────

const RE = {
  // Strip "Page N of NNNN" prefix that PDF fuses with first content token
  pagePrefix:   /^Page\s+\d+\s+of\s+\d+/,

  instituteCode:/^(\d{5})\s*-\s*(.+)$/,

  // Passed:  ROLL (gpa3: X, gpa2: Y, gpa1: Z)
  // gpa2 can be empty:  gpa2:,
  passedInline: /(\d{5,7})\s*\(gpa3:\s*([\d.]*),\s*gpa2:\s*([\d.]*),\s*gpa1:\s*([\d.]*)\)/g,
  passedLine:   /\d{5,7}\s*\(gpa\d:/,

  // Referred/Failed:  ROLL { ... }
  // May span multiple lines — joined before this runs
  failedOrRef:  /^(\d{5,7})\s*\{(.+)\}$/,
  // opening brace without closing — continuation line
  openBrace:    /^\d{5,7}\s*\{[^}]*$/,
  // subject codes in failed/referred content
  subjectCode:  /\d{5}\([TP][^)]*\)/g,

  gpa3: /gpa3:\s*([\d.]+|ref)/,
  gpa2: /gpa2:\s*([\d.]+|ref)/,
  gpa1: /gpa1:\s*([\d.]+|ref)/,
  refSub: /ref_sub:\s*(.+)/,

  // Meta
  semester:   /\b([1-7])(?:st|nd|rd|th)\s+semester/i,
  examYear:   /\b(20\d{2})\b/g,
  regulation: /\((\d{4})\s+Regulation\)/i,
} as const;

// ─── Meta Extractor ───────────────────────────────────────────────────────────

const extractExamMeta = (rawText: string): ExamMeta => {
  // Use full text — header info can be anywhere in first pages
  const headerText = rawText.slice(0, 4000);

  const semMatch  = headerText.match(RE.semester);
  const semester  = semMatch?.[1] ? (SEMESTER_MAP[semMatch[1]] ?? '1st') : '1st';

  const yearHits  = [...headerText.matchAll(RE.examYear)]
    .map((m) => parseInt(m[1], 10))
    .filter((y) => y >= 2000 && y <= 2100);
  const examYear  = yearHits.length > 0 ? Math.max(...yearHits) : new Date().getFullYear();

  const regMatch  = headerText.match(RE.regulation);
  const regulation = regMatch?.[1] ?? 'Unknown';

  console.log(`[Meta] semester=${semester}, year=${examYear}, regulation=${regulation}`);
  return { semester, examYear, regulation };
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const parseGpa = (val: string | undefined): number | null => {
  if (!val || val.trim() === '') return null;
  const n = parseFloat(val);
  return isNaN(n) ? null : n;
};

const gpaOrNull = (val: string | undefined): number | null =>
  !val || val === 'ref' ? null : parseGpa(val);

const extractGpas = (content: string) => ({
  gpa1: content.match(RE.gpa1)?.[1],
  gpa2: content.match(RE.gpa2)?.[1],
  gpa3: content.match(RE.gpa3)?.[1],
});

const nullGpas = () => ({
  gpa1: null, gpa2: null, gpa3: null,
  gpa4: null, gpa5: null, gpa6: null, gpa7: null,
});

// ─── Page Text Cleaner ────────────────────────────────────────────────────────

/**
 * Each page starts with "Page N of 1226" fused directly onto content.
 * Strip it so institute/roll lines parse cleanly.
 */
const cleanPageText = (raw: string): string =>
  raw.replace(RE.pagePrefix, '').trim();

// ─── Line Joiner ─────────────────────────────────────────────────────────────

/**
 * Key insight from PDF analysis:
 * 1. Passed records are already inline — multiple per line, no joining needed
 * 2. Referred/Failed records CAN span lines:
 *    "601703 { gpa3: ref, gpa2: ref, gpa1: 2.93, ref_sub:\n25912(T), 25922(T) }"
 * 3. Page breaks split records mid-line — we join ALL page text first
 */
const joinLines = (rawText: string): string[] => {
  const lines = rawText.split('\n');
  const result: string[] = [];
  let buffer = '';

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    if (buffer) {
      // We're accumulating a multi-line { } block
      buffer += ' ' + line;
      if (buffer.includes('}')) {
        result.push(buffer);
        buffer = '';
      }
      continue;
    }

    // Start of a { block without closing }
    if (RE.openBrace.test(line) && !line.includes('}')) {
      buffer = line;
      continue;
    }

    result.push(line);
  }

  if (buffer) result.push(buffer); // flush unclosed buffer
  return result;
};

// ─── Student Parsers ──────────────────────────────────────────────────────────

const parsePassed = (
  line: string,
  institute: { code: string; name: string },
  meta: ExamMeta,
): ParsedStudent[] => {
  const results: ParsedStudent[] = [];
  // Reset lastIndex — regex is reused
  const re = new RegExp(RE.passedInline.source, 'g');
  let m: RegExpExecArray | null;

  while ((m = re.exec(line)) !== null) {
    results.push({
      roll:          m[1],
      instituteCode: institute.code,
      instituteName: institute.name,
      ...meta,
      status: 'Passed',
      gpa3:   parseGpa(m[2]),   // gpa3 = current semester
      gpa2:   parseGpa(m[3]),   // gpa2 = previous semester (may be empty)
      gpa1:   parseGpa(m[4]),   // gpa1 = first semester
      gpa4: null, gpa5: null, gpa6: null, gpa7: null,
      referredSubjects: [],
      failedSubjects:   [],
    });
  }

  return results;
};

const parseFailedOrReferred = (
  line: string,
  institute: { code: string; name: string },
  meta: ExamMeta,
): ParsedStudent | null => {
  const m = line.match(RE.failedOrRef);
  if (!m) return null;

  const roll    = m[1];
  const content = m[2];
  const hasGpa  = /gpa\d:/.test(content);

  if (hasGpa) {
    const gpas             = extractGpas(content);
    const refSubRaw        = content.match(RE.refSub)?.[1];
    const referredSubjects = refSubRaw
      ? (refSubRaw.match(RE.subjectCode) ?? [])
      : [];

    return {
      roll,
      instituteCode: institute.code,
      instituteName: institute.name,
      ...meta,
      status: 'Referred',
      gpa1: gpaOrNull(gpas.gpa1),
      gpa2: gpaOrNull(gpas.gpa2),
      gpa3: gpaOrNull(gpas.gpa3),
      gpa4: null, gpa5: null, gpa6: null, gpa7: null,
      referredSubjects,
      failedSubjects: [],
    };
  }

  // Pure failed — only subject codes, no gpa values
  return {
    roll,
    instituteCode: institute.code,
    instituteName: institute.name,
    ...meta,
    status: 'Failed',
    ...nullGpas(),
    referredSubjects: [],
    failedSubjects: content.match(RE.subjectCode) ?? [],
  };
};

// ─── Line Processor ───────────────────────────────────────────────────────────

const processLines = (lines: string[], meta: ExamMeta): ParsedStudent[] => {
  const students: ParsedStudent[] = [];

  // ── Critical fix: institute persists across page breaks ──────────────────
  // We track it globally and only reset when a NEW institute header appears
  let currentInstitute: { code: string; name: string } | null = null;
  let isTarget = false;

  for (const rawLine of lines) {
    // Strip "Page N of 1226" prefix fused onto content
    const line = cleanPageText(rawLine);
    if (!line) continue;

    // ── Institute header detection ──────────────────────────────────────────
    // Must not contain '{' or gpa (those are data lines, not headers)
    const instMatch = line.match(RE.instituteCode);
    if (instMatch && !line.includes('{') && !/gpa\d:/.test(line)) {
      currentInstitute = { code: instMatch[1], name: instMatch[2].trim() };
      isTarget         = instMatch[1] === TARGET_INSTITUTE_CODE;
      console.log(`[Parser] Institute: ${currentInstitute.code} | target=${isTarget}`);
      continue;
    }

    // Skip everything outside target institute
    if (!isTarget) continue;

    // ── Passed students (inline format, multiple per line) ──────────────────
    if (RE.passedLine.test(line)) {
      students.push(...parsePassed(line, currentInstitute!, meta));
      continue;
    }

    // ── Referred / Failed students ──────────────────────────────────────────
    if (/^\d{5,7}\s*\{/.test(line)) {
      const student = parseFailedOrReferred(line, currentInstitute!, meta);
      if (student) students.push(student);
    }
  }

  return students;
};

// ─── PDF Parser ───────────────────────────────────────────────────────────────

const parsePDFBuffer = async (buffer: Buffer): Promise<ParseResult> => {
  let rawText: string;

  try {
    const pdfParse = (await import('pdf-parse')).default;
    const pdfData  = await pdfParse(buffer);
    rawText        = pdfData.text;
  } catch (err) {
    console.error('[PDF Parser] Failed to parse buffer:', err);
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'PDF parsing failed');
  }

  const meta     = extractExamMeta(rawText);
  const lines    = joinLines(rawText);
  const students = processLines(lines, meta);

  console.log(`[Parser] Total parsed from institute ${TARGET_INSTITUTE_CODE}: ${students.length}`);

  return { meta, totalParsed: students.length, students };
};

// ─── DB Helpers ───────────────────────────────────────────────────────────────

const buildRollMap = async (rolls: string[]): Promise<Map<string, number>> => {
  const found = await prisma.student.findMany({
    where: { roll: { in: rolls }, isDeleted: false },
    select: { id: true, roll: true },
  });
  return new Map(found.map((s) => [s.roll, s.id]));
};

const toLinkedInput = (
  s: ParsedStudent,
  studentId: number,
): Prisma.DiplomaResultCreateManyInput => ({
  studentId,
  roll:          s.roll,
  instituteCode: s.instituteCode,
  instituteName: s.instituteName,
  semester:      s.semester,
  regulation:    s.regulation,
  examYear:      s.examYear,
  status:        s.status,
  gpa1: s.gpa1, gpa2: s.gpa2, gpa3: s.gpa3,
  gpa4: s.gpa4, gpa5: s.gpa5, gpa6: s.gpa6, gpa7: s.gpa7,
  referredSubjects: s.referredSubjects,
  failedSubjects:   s.failedSubjects,
});

const toUnlinkedInput = (
  s: ParsedStudent,
): Prisma.DiplomaResultCreateManyInput => ({
  roll:          s.roll,
  instituteCode: s.instituteCode,
  instituteName: s.instituteName,
  semester:      s.semester,
  regulation:    s.regulation,
  examYear:      s.examYear,
  status:        s.status,
  gpa1: s.gpa1, gpa2: s.gpa2, gpa3: s.gpa3,
  gpa4: s.gpa4, gpa5: s.gpa5, gpa6: s.gpa6, gpa7: s.gpa7,
  referredSubjects: s.referredSubjects,
  failedSubjects:   s.failedSubjects,
});

// ─── DB Saver ─────────────────────────────────────────────────────────────────

const saveParsedResults = async (students: ParsedStudent[]): Promise<SaveResult> => {
  if (students.length === 0)
    return { savedCount: 0, linkedCount: 0, skippedCount: 0, skippedRolls: [] };

  let savedCount   = 0;
  let linkedCount  = 0;
  let skippedCount = 0;
  const skippedRolls: string[] = [];

  for (let i = 0; i < students.length; i += BATCH_SIZE) {
    const batch    = students.slice(i, i + BATCH_SIZE);
    const batchNum = Math.ceil((i + 1) / BATCH_SIZE);
    const rollMap  = await buildRollMap(batch.map((s) => s.roll));

    const linkedData:   Prisma.DiplomaResultCreateManyInput[] = [];
    const unlinkedData: Prisma.DiplomaResultCreateManyInput[] = [];

    for (const s of batch) {
      const studentId = rollMap.get(s.roll);
      if (studentId !== undefined) {
        linkedData.push(toLinkedInput(s, studentId));
      } else {
        skippedRolls.push(s.roll);
        skippedCount++;
        unlinkedData.push(toUnlinkedInput(s));
      }
    }

    if (linkedData.length > 0) {
      await prisma.diplomaResult.createMany({ data: linkedData, skipDuplicates: true });
      linkedCount += linkedData.length;
      savedCount  += linkedData.length;
    }

    if (unlinkedData.length > 0) {
      await prisma.diplomaResult.createMany({ data: unlinkedData, skipDuplicates: true });
      savedCount += unlinkedData.length;
    }

    console.log(`[DB] Batch ${batchNum}: linked=${linkedData.length}, unlinked=${unlinkedData.length}`);
  }

  if (skippedRolls.length > 0) {
    console.warn(`[DB] ${skippedRolls.length} rolls saved without Student link:`, skippedRolls);
  }

  return { savedCount, linkedCount, skippedCount, skippedRolls };
};

// ─── Export ───────────────────────────────────────────────────────────────────

export const resultParserService = {
  parsePDFBuffer,
  saveParsedResults,
};