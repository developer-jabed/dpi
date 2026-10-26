/**
 * resultParser.service.ts
 * Unified parser – supports both 1st Semester (simple) and 2nd+ Semester (labeled) formats
 * Target: Dinajpur Polytechnic Institute (13085)
 */

import { DiplomaResultStatus, SubjectResultType } from '@prisma/client';
import httpStatus from 'http-status';
import ApiError from '../../errors/api.error';
import { prisma } from '../../shared/prisma';
import type {
  ExamMeta,
  ParsedStudent,
  ParseResult,
  SaveResult,
} from './resultParser.interface';
import { resultQueryService } from '../result/result.service';

// ─── Constants ────────────────────────────────────────────────────────────────
const TARGET_INSTITUTE_CODE = '13085' as const;
const DB_CHUNK_SIZE = 100;
const DB_CHUNK_CONCURRENCY = 8;
const DROPOUT_SUBJECT_THRESHOLD = 4;
const CACHE_WARM_CONCURRENCY = 10;

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

// ─── Regex Catalogue ──────────────────────────────────────────────────────────
const RE = {
  institute: /^(\d{5})\s*[-–]\s*(.+?)(?:,|$)/i,

  sectionPassed: /^\s*1\s*$/,
  sectionReferred: /^\s*2\s*$/,
  sectionFailed: /^\s*25\s*$/,
  sectionPassedText: /passed in all subjects/i,
  sectionReferredText: /failed in three or less subjects/i,
  sectionFailedText: /failed in four or more subjects/i,

  semester: /(\d)(?:st|nd|rd|th)\s+Semester/i,
  examYearNear: /(?:Examination|Result|held).*?(20\d{2})/i,
  regulation: /(?:Regulation|Reg\.)\s*[:\s]*(\d{4})/i,
  yearAny: /\b(20\d{2})\b/g,

  // Format A – 1st semester simple
  passedSimple: /(\d{5,7})\s*\(\s*([\d.]+)\s*\)/g,
  bracedSimple: /(\d{5,7})\s*\{\s*([^}]*)\}/g,

  // Format B – 2nd+ semester labeled
  passedLabeled: /(\d{5,7})\s*\(\s*((?:gpa\d+:\s*[\d.]+(?:\s*,\s*)?)+)\s*\)/gi,
  bracedLabeled:
    /(\d{5,7})\s*\{\s*((?:gpa\d+:\s*(?:ref|[\d.]+)(?:\s*,\s*)?)*(?:ref_sub:\s*)?([^}]+))\}/gi,

  subjectCode: /(\d{5})(?:\([TP]+\))?/g,
  gpaPair: /gpa(\d+):\s*([\d.]+|ref)/gi,
} as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function cleanText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/\u00A0/g, ' ')
    .replace(/[^\S\n]+/g, ' ')
    .trim();
}

function joinContinuationLines(rawLines: string[]): string[] {
  const joined: string[] = [];
  let buffer = '';

  for (const line of rawLines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (buffer) {
        joined.push(buffer);
        buffer = '';
      }
      continue;
    }

    // Continue braced record
    if (buffer && buffer.includes('{') && !buffer.includes('}')) {
      buffer += ' ' + trimmed;
      if (buffer.includes('}')) {
        joined.push(buffer);
        buffer = '';
      }
      continue;
    }

    if (buffer) joined.push(buffer);
    buffer = trimmed;
  }

  if (buffer) joined.push(buffer);
  return joined;
}

function extractSubjects(text: string): string[] {
  const codes = new Set<string>();
  const re = new RegExp(RE.subjectCode.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    codes.add(m[1]);
  }
  return Array.from(codes);
}

function extractGpas(text: string): Record<string, number | null> {
  const gpas: Record<string, number | null> = {};
  const re = new RegExp(RE.gpaPair.source, 'gi');
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    gpas[`gpa${m[1]}`] = m[2].toLowerCase() === 'ref' ? null : parseFloat(m[2]);
  }
  return gpas;
}

function emptyGpas() {
  return {
    gpa1: null as number | null,
    gpa2: null as number | null,
    gpa3: null as number | null,
    gpa4: null as number | null,
    gpa5: null as number | null,
    gpa6: null as number | null,
    gpa7: null as number | null,
  };
}

// ─── Meta Extraction ──────────────────────────────────────────────────────────
function extractExamMeta(text: string, filename?: string): ExamMeta {
  const semesterMatch = text.match(RE.semester);
  const semesterNum = semesterMatch?.[1] ?? '1';
  const semesterName = SEMESTER_LABEL[semesterNum] ?? `${semesterNum}th`;

  let examYear = 2025;
  const near = text.match(RE.examYearNear);
  if (near) {
    examYear = parseInt(near[1], 10);
  } else {
    const years = [...text.matchAll(RE.yearAny)].map((m) => parseInt(m[1], 10));
    if (years.length) {
      const freq: Record<number, number> = {};
      for (const y of years) freq[y] = (freq[y] || 0) + 1;
      examYear = Number(
        Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0],
      );
    }
  }

  let regulation = '2022';
  const regMatch = text.match(RE.regulation);
  if (regMatch) {
    regulation = regMatch[1];
  } else if (filename) {
    const fnReg = filename.match(/(\d{4})_Regulation/i);
    if (fnReg) regulation = fnReg[1];
  }

  return { semesterName, examYear, regulation };
}

// ─── Parsing Core ─────────────────────────────────────────────────────────────
function parsePassedLine(
  line: string,
  instituteCode: string,
  instituteName: string,
  meta: ExamMeta,
): ParsedStudent[] {
  const students: ParsedStudent[] = [];

  // Format A – simple GPA
  const simpleRe = new RegExp(RE.passedSimple.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = simpleRe.exec(line)) !== null) {
    const gpas = emptyGpas();
    // Current semester GPA goes into the corresponding slot
    const semNum = parseInt(meta.semesterName) || 1;
    if (semNum <= 7) {
      (gpas as any)[`gpa${semNum}`] = parseFloat(m[2]);
    }

    students.push({
      roll: m[1],
      instituteCode,
      instituteName,
      semesterName: meta.semesterName,
      examYear: meta.examYear,
      regulation: meta.regulation,
      status: DiplomaResultStatus.PASSED,
      ...gpas,
      referredSubjects: [],
      failedSubjects: [],
    });
  }

  // Format B – labeled
  const labeledRe = new RegExp(RE.passedLabeled.source, 'gi');
  while ((m = labeledRe.exec(line)) !== null) {
    const extracted = extractGpas(m[2]);
    const gpas = emptyGpas();
    Object.assign(gpas, extracted);

    students.push({
      roll: m[1],
      instituteCode,
      instituteName,
      semesterName: meta.semesterName,
      examYear: meta.examYear,
      regulation: meta.regulation,
      status: DiplomaResultStatus.PASSED,
      ...gpas,
      referredSubjects: [],
      failedSubjects: [],
    });
  }

  return students;
}

function parseBracedLine(
  line: string,
  instituteCode: string,
  instituteName: string,
  meta: ExamMeta,
  forcedStatus: DiplomaResultStatus,
): ParsedStudent | null {
  // Format B – labeled
  const labeledRe = new RegExp(RE.bracedLabeled.source, 'gi');
  let m = labeledRe.exec(line);
  if (m) {
    const roll = m[1];
    const body = m[2] || '';
    const subjects = extractSubjects(body);
    const extracted = extractGpas(body);
    const gpas = emptyGpas();
    Object.assign(gpas, extracted);

    const isFailed =
      forcedStatus === DiplomaResultStatus.FAILED ||
      subjects.length >= DROPOUT_SUBJECT_THRESHOLD;

    return {
      roll,
      instituteCode,
      instituteName,
      semesterName: meta.semesterName,
      examYear: meta.examYear,
      regulation: meta.regulation,
      status: isFailed ? DiplomaResultStatus.FAILED : DiplomaResultStatus.REFERRED,
      ...gpas,
      referredSubjects: isFailed ? [] : subjects,
      failedSubjects: isFailed ? subjects : [],
    };
  }

  // Format A – simple subjects
  const simpleRe = new RegExp(RE.bracedSimple.source, 'g');
  m = simpleRe.exec(line);
  if (m) {
    const roll = m[1];
    const subjects = extractSubjects(m[2]);
    const isFailed =
      forcedStatus === DiplomaResultStatus.FAILED ||
      subjects.length >= DROPOUT_SUBJECT_THRESHOLD;

    return {
      roll,
      instituteCode,
      instituteName,
      semesterName: meta.semesterName,
      examYear: meta.examYear,
      regulation: meta.regulation,
      status: isFailed ? DiplomaResultStatus.FAILED : DiplomaResultStatus.REFERRED,
      ...emptyGpas(),
      referredSubjects: isFailed ? [] : subjects,
      failedSubjects: isFailed ? subjects : [],
    };
  }

  return null;
}

function processLines(lines: string[], meta: ExamMeta): ParsedStudent[] {
  const students: ParsedStudent[] = [];
  let currentInstituteCode: string | null = null;
  let currentInstituteName = '';
  let currentSection: 'PASSED' | 'REFERRED' | 'FAILED' | null = null;

  for (const line of lines) {
    const instMatch = line.match(RE.institute);
    if (instMatch) {
      currentInstituteCode = instMatch[1];
      currentInstituteName = instMatch[2].trim();
      currentSection = null;
      continue;
    }

    if (currentInstituteCode !== TARGET_INSTITUTE_CODE) continue;

    if (RE.sectionPassed.test(line) || RE.sectionPassedText.test(line)) {
      currentSection = 'PASSED';
      continue;
    }
    if (RE.sectionReferred.test(line) || RE.sectionReferredText.test(line)) {
      currentSection = 'REFERRED';
      continue;
    }
    if (RE.sectionFailed.test(line) || RE.sectionFailedText.test(line)) {
      currentSection = 'FAILED';
      continue;
    }

    if (!currentSection) continue;

    if (currentSection === 'PASSED') {
      students.push(
        ...parsePassedLine(
          line,
          currentInstituteCode,
          currentInstituteName,
          meta,
        ),
      );
    } else {
      const student = parseBracedLine(
        line,
        currentInstituteCode,
        currentInstituteName,
        meta,
        currentSection === 'FAILED'
          ? DiplomaResultStatus.FAILED
          : DiplomaResultStatus.REFERRED,
      );
      if (student) students.push(student);
    }
  }

  return students;
}

// ─── Public Parse ─────────────────────────────────────────────────────────────
export async function parseResultPdf(
  buffer: Buffer,
  filename?: string,
): Promise<ParseResult> {
  const pdf = (await import('pdf-parse')).default;
  const data = await pdf(buffer);
  const rawText = cleanText(data.text);
  const lines = joinContinuationLines(rawText.split('\n'));

  const meta = extractExamMeta(rawText, filename);
  console.log(
    `[Meta] semesterName="${meta.semesterName}" | examYear=${meta.examYear} | regulation="${meta.regulation}"`,
  );

  const students = processLines(lines, meta);

  const summary = {
    PASSED: students.filter((s) => s.status === DiplomaResultStatus.PASSED).length,
    REFERRED: students.filter((s) => s.status === DiplomaResultStatus.REFERRED).length,
    FAILED: students.filter((s) => s.status === DiplomaResultStatus.FAILED).length,
  };

  console.log(
    `[Parser] PASSED=${summary.PASSED} | REFERRED=${summary.REFERRED} | FAILED=${summary.FAILED} | TOTAL=${students.length}`,
  );

  return {
    meta,
    totalParsed: students.length,
    students,
  };
}

// ─── DB Helpers ───────────────────────────────────────────────────────────────
// ─── DB Helpers (High Performance) ────────────────────────────────────────────

async function resolveSubjects(codes: string[]): Promise<Map<string, number>> {
  if (!codes.length) return new Map();
  const subjects = await prisma.subject.findMany({
    where: { code: { in: codes } },
    select: { id: true, code: true },
  });
  return new Map(subjects.map((s) => [s.code, s.id]));
}

async function getStudentIdMap(rolls: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  const BATCH = 800;

  for (let i = 0; i < rolls.length; i += BATCH) {
    const slice = rolls.slice(i, i + BATCH);
    const students = await prisma.student.findMany({
      where: { roll: { in: slice }, isDeleted: false },
      select: { id: true, roll: true },
    });
    for (const s of students) map.set(s.roll, s.id);
  }
  return map;
}

// ─── Public Save (Optimized) ──────────────────────────────────────────────────
export async function saveParsedResults(
  parseResult: ParseResult,
): Promise<SaveResult> {
  const { students } = parseResult;

  if (!students.length) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'No students parsed from PDF');
  }

  console.log(`[DB] Preparing to save ${students.length} records...`);

  // 1. Resolve subjects once
  const allCodes = [
    ...new Set([
      ...students.flatMap((s) => s.referredSubjects),
      ...students.flatMap((s) => s.failedSubjects),
    ]),
  ];
  const subjectMap = await resolveSubjects(allCodes);

  const missing = allCodes.filter((c) => !subjectMap.has(c));
  if (missing.length) {
    console.warn(
      `[DB] ${missing.length} subject code(s) missing:`,
      missing.slice(0, 10).join(', '),
    );
  }

  // 2. Pre-fetch all student IDs
  const studentIdMap = await getStudentIdMap(students.map((s) => s.roll));
  console.log(`[DB] Matched ${studentIdMap.size} students`);

  // 3. Upsert all DiplomaResult records with high concurrency
  const UPSERT_CONCURRENCY = 25; // safe for most Postgres
  const diplomaResultIds: number[] = [];
  const orphanRolls: string[] = [];
  let linkedCount = 0;

  // Helper to process one student
  const upsertOne = async (s: ParsedStudent) => {
    const studentId = studentIdMap.get(s.roll) ?? null;

    const result = await prisma.diplomaResult.upsert({
      where: {
        roll_semesterName_examYear_regulation: {
          roll: s.roll,
          semesterName: s.semesterName,
          examYear: s.examYear,
          regulation: s.regulation,
        },
      },
      create: {
        roll: s.roll,
        status: s.status,
        gpa1: s.gpa1,
        gpa2: s.gpa2,
        gpa3: s.gpa3,
        gpa4: s.gpa4,
        gpa5: s.gpa5,
        gpa6: s.gpa6,
        gpa7: s.gpa7,
        semesterName: s.semesterName,
        examYear: s.examYear,
        regulation: s.regulation,
        instituteCode: s.instituteCode,
        instituteName: s.instituteName,
        studentId,
        isDeleted: false,
      },
      update: {
        status: s.status,
        gpa1: s.gpa1,
        gpa2: s.gpa2,
        gpa3: s.gpa3,
        gpa4: s.gpa4,
        gpa5: s.gpa5,
        gpa6: s.gpa6,
        gpa7: s.gpa7,
        instituteCode: s.instituteCode,
        instituteName: s.instituteName,
        studentId,
        isDeleted: false,
      },
      select: { id: true },
    });

    if (studentId) linkedCount++;
    else orphanRolls.push(s.roll);

    return { id: result.id, student: s };
  };

  // Process in concurrent batches
  const results: { id: number; student: ParsedStudent }[] = [];

  for (let i = 0; i < students.length; i += UPSERT_CONCURRENCY) {
    const batch = students.slice(i, i + UPSERT_CONCURRENCY);
    const batchResults = await Promise.all(batch.map(upsertOne));
    results.push(...batchResults);

    if ((i / UPSERT_CONCURRENCY) % 4 === 0) {
      console.log(`[DB] Upserted ${Math.min(i + UPSERT_CONCURRENCY, students.length)}/${students.length}`);
    }
  }

  const savedCount = results.length;
  console.log(`[DB] All ${savedCount} DiplomaResult records upserted`);

  // 4. Collect all diplomaResult IDs
  const allResultIds = results.map((r) => r.id);

  // 5. Delete ALL old subjects in one go (very fast)
  if (allResultIds.length > 0) {
    await prisma.diplomaResultSubject.deleteMany({
      where: { diplomaResultId: { in: allResultIds } },
    });
    console.log(`[DB] Cleared old subjects`);
  }

  // 6. Build all subject rows and insert in large batches
  const subjectRows: {
    diplomaResultId: number;
    subjectCode: string;
    subjectId: number | null;
    type: SubjectResultType;
  }[] = [];

  for (const { id, student } of results) {
    for (const code of student.referredSubjects) {
      subjectRows.push({
        diplomaResultId: id,
        subjectCode: code,
        subjectId: subjectMap.get(code) ?? null,
        type: SubjectResultType.REFERRED,
      });
    }
    for (const code of student.failedSubjects) {
      subjectRows.push({
        diplomaResultId: id,
        subjectCode: code,
        subjectId: subjectMap.get(code) ?? null,
        type: SubjectResultType.FAILED,
      });
    }
  }

  // Insert subjects in large chunks
  const SUBJECT_BATCH = 1000;
  for (let i = 0; i < subjectRows.length; i += SUBJECT_BATCH) {
    const slice = subjectRows.slice(i, i + SUBJECT_BATCH);
    if (slice.length) {
      await prisma.diplomaResultSubject.createMany({ data: slice });
    }
  }
  console.log(`[DB] Inserted ${subjectRows.length} subject rows`);

  // 7. Cache
  const rolls = students.map((s) => s.roll);

  console.log(`[Cache] Invalidating ${rolls.length} keys...`);
  await resultQueryService.invalidateResultCache(rolls);

  console.log(`[Cache] Warming cache (background)...`);
  (async () => {
    const WARM = 15;
    for (let i = 0; i < rolls.length; i += WARM) {
      const slice = rolls.slice(i, i + WARM);
      await Promise.all(
        slice.map((roll) =>
          resultQueryService.getResultByRoll(roll).catch(() => null),
        ),
      );
    }
    console.log(`[Cache] Warming finished`);
  })();

  return {
    savedCount,
    linkedCount,
    orphanCount: orphanRolls.length,
    skippedCount: 0,
    orphanRolls: orphanRolls.slice(0, 100),
  };
}

export const resultParserService = {
  parseResultPdf,
  saveParsedResults,
};