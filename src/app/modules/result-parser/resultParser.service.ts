/**
 * resultParser.service.ts
 * Fast BTEB diploma result parser (all semesters) + bulk DB save.
 *
 * Speed plan
 *  1. pdftotext (Poppler) extracts the whole PDF in ~1s (pdf-parse = fallback only)
 *  2. Only the target institute's chunk is cleaned + parsed (a few KB)
 *  3. One global regex; status is decided from the record SHAPE, not section headers
 *  4. Text + parse results cached in memory by file hash (re-upload = instant)
 *  5. DB: one INSERT .. ON CONFLICT per 1000 rows (auto-falls back to Prisma upsert)
 */

import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { DiplomaResultStatus, Prisma, SubjectResultType } from '@prisma/client';
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
const TARGET_INSTITUTE_CODE = '13085';
const DROPOUT_SUBJECT_THRESHOLD = 4; // only used for old 1st-semester format
const RAW_CHUNK = 1000;
const SUBJECT_CHUNK = 2000;
const FALLBACK_UPSERT_CONCURRENCY = 25;
const CACHE_WARM_CONCURRENCY = 15;
const PDFTOTEXT_TIMEOUT_MS = 60_000;
const MEMORY_CACHE_LIMIT = 8;

const SEMESTER_LABEL: Readonly<Record<string, string>> = {
  '1': '1st', '2': '2nd', '3': '3rd', '4': '4th',
  '5': '5th', '6': '6th', '7': '7th', '8': '8th',
};

// ─── Regexes (compiled once) ──────────────────────────────────────────────────
const INSTITUTE_HEADER_RE = /^(\d{5}) - (.*)$/gm;
// roll (…)  or  roll {…}
const RECORD_RE = /(?<!\d)(\d{6})(?!\d)\s*(?:\(([^)]*)\)|\{([^}]*)\})/g;
const RECORD_START_RE = /(?<!\d)(\d{6})(?!\d)\s*[({]/g;
const GPA_RE = /gpa(\d):\s*(ref|\d+(?:\.\d+)?)?/g;
const SUBJECT_RE = /(\d{5})\(/g;

// Page header/footer + notice lines that can sit in the middle of a record
const NOISE_LINE_RE =
  /^(?:\d{1,2}$|Page \d+ of \d+|Memo No\.|Bangladesh Technical Education Board|Bngladesh Technical|Office of the Controller|Agargaon|Note:|\d\. The result is hereby|authority of correcting|\d\. After rescrutiny|\( ?Enrg\.|Controller of Examinations|Phone ?:|Copy of the published|\d{1,3}(?:-\d{2,3})?\. (?:Director|Secretary|Principal|Deputy|Assistant|Guard)|NOTICE|Date ?:|\(Md\. |Deputy Controller|Assistant Controller|(?:\d{1,2}\s+)?It is to be notified|are listed below|listed below)/i;

// ─── Small LRU ────────────────────────────────────────────────────────────────
class Lru<V> {
  private map = new Map<string, V>();
  constructor(private limit: number) {}
  get(k: string): V | undefined {
    const v = this.map.get(k);
    if (v !== undefined) {
      this.map.delete(k);
      this.map.set(k, v);
    }
    return v;
  }
  set(k: string, v: V) {
    this.map.delete(k);
    this.map.set(k, v);
    if (this.map.size > this.limit) {
      this.map.delete(this.map.keys().next().value as string);
    }
  }
}

const textCache = new Lru<string>(3);
const parseCache = new Lru<ParseResult>(MEMORY_CACHE_LIMIT);
const inflight = new Map<string, Promise<ParseResult>>();

// ─── PDF → text ───────────────────────────────────────────────────────────────
function pdftotext(buffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const p = spawn('pdftotext', ['-enc', 'UTF-8', '-nopgbrk', '-', '-']);
    const chunks: Buffer[] = [];
    const timer = setTimeout(() => {
      p.kill('SIGKILL');
      reject(new Error('pdftotext timeout'));
    }, PDFTOTEXT_TIMEOUT_MS);

    p.stdout.on('data', (c: Buffer) => chunks.push(c));
    p.on('error', (e) => { clearTimeout(timer); reject(e); });
    p.stdin.on('error', () => { /* EPIPE if process dies early; 'close' reports it */ });
    p.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(Buffer.concat(chunks).toString('utf8'));
      else reject(new Error(`pdftotext exited with code ${code}`));
    });
    p.stdin.end(buffer);
  });
}

async function extractText(buffer: Buffer, hash: string): Promise<string> {
  const cached = textCache.get(hash);
  if (cached) return cached;

  let text: string;
  try {
    text = await pdftotext(buffer);
  } catch (err) {
    console.warn(`[Parser] pdftotext failed (${(err as Error).message}), using pdf-parse fallback (slow)`);
    const pdf = (await import('pdf-parse')).default;
    text = (await pdf(buffer)).text;
  }
  text = text.replace(/\r\n?/g, '\n').replace(/\u00A0/g, ' ');
  textCache.set(hash, text);
  return text;
}

// ─── Text helpers ─────────────────────────────────────────────────────────────
function extractMeta(text: string, filename?: string): ExamMeta {
  const head = text.slice(0, 8000);
  const sem = head.match(/(\d)(?:st|nd|rd|th)\s+Semester/i)?.[1] ?? '1';
  const regulation =
    head.match(/\((\d{4})\s+Regulation\)/i)?.[1] ??
    head.match(/(?:Regulation|Reg\.)\s*[:\s]*(\d{4})/i)?.[1] ??
    filename?.match(/(\d{4})_Regulation/i)?.[1] ??
    '2022';
  const examYear = parseInt(
    head.match(/ENGINEERING,\s*(20\d{2})/i)?.[1] ??
      head.match(/\b(20\d{2})\b/)?.[1] ??
      '2025',
    10,
  );
  return {
    semesterName: SEMESTER_LABEL[sem] ?? `${sem}th`,
    examYear,
    regulation,
  };
}

function sliceInstitute(text: string, code: string) {
  const headers: { code: string; name: string; start: number }[] = [];
  INSTITUTE_HEADER_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = INSTITUTE_HEADER_RE.exec(text)) !== null) {
    headers.push({
      code: m[1],
      name: m[2].split(',')[0].trim(),
      start: m.index,
    });
  }
  const i = headers.findIndex((h) => h.code === code);
  if (i < 0) return null;
  const end = i + 1 < headers.length ? headers[i + 1].start : text.length;
  return { name: headers[i].name, chunk: text.slice(headers[i].start, end) };
}

/** Drops page header/footer lines (they can split a record) and flattens to one line. */
function cleanChunk(chunk: string): string {
  const out: string[] = [];
  const lines = chunk.split('\n');
  for (let i = 1; i < lines.length; i++) { // i=1 skips the institute header line
    const line = lines[i].trim();
    if (line && !NOISE_LINE_RE.test(line)) out.push(line);
  }
  return out.join(' ').replace(/\s+/g, ' ');
}

function emptyGpas() {
  return {
    gpa1: null as number | null, gpa2: null as number | null,
    gpa3: null as number | null, gpa4: null as number | null,
    gpa5: null as number | null, gpa6: null as number | null,
    gpa7: null as number | null,
  };
}

function parseGpas(body: string) {
  const g = emptyGpas();
  GPA_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = GPA_RE.exec(body)) !== null) {
    const key = `gpa${m[1]}` as keyof typeof g;
    if (key in g) g[key] = m[2] && m[2] !== 'ref' ? parseFloat(m[2]) : null;
  }
  return g;
}

function parseSubjects(body: string): string[] {
  const set = new Set<string>();
  SUBJECT_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = SUBJECT_RE.exec(body)) !== null) set.add(m[1]);
  return [...set];
}

// ─── Core parse ───────────────────────────────────────────────────────────────
function parseChunk(
  flat: string,
  instituteCode: string,
  instituteName: string,
  meta: ExamMeta,
): ParsedStudent[] {
  const students: ParsedStudent[] = [];
  const seen = new Set<string>();
  const semNum = parseInt(meta.semesterName, 10) || 1;

  const base = (roll: string) => ({
    roll,
    instituteCode,
    instituteName,
    semesterName: meta.semesterName,
    examYear: meta.examYear,
    regulation: meta.regulation,
  });

  RECORD_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = RECORD_RE.exec(flat)) !== null) {
    const roll = m[1];
    if (seen.has(roll)) continue;
    seen.add(roll);

    // ── PASSED:  roll ( … )
    if (m[2] !== undefined) {
      const body = m[2];
      let gpas = emptyGpas();
      if (body.includes('gpa')) {
        gpas = parseGpas(body);
      } else {
        const v = body.match(/\d+(?:\.\d+)?/)?.[0]; // old 1st-semester "(3.45)"
        if (v && semNum <= 7) (gpas as any)[`gpa${semNum}`] = parseFloat(v);
      }
      students.push({
        ...base(roll),
        status: DiplomaResultStatus.PASSED,
        ...gpas,
        referredSubjects: [],
        failedSubjects: [],
      });
      continue;
    }

    // ── { … }  → REFERRED (has gpa labels) or FAILED (subjects only)
    const body = m[3] ?? '';
    const hasGpa = body.includes('gpa');
    const subjectPart = body.includes('ref_sub:') ? body.split('ref_sub:')[1] : body;
    const subjects = parseSubjects(subjectPart);

    // 2nd+ semester: shape decides. 1st semester (no gpa labels anywhere): old count rule.
    const isReferred = hasGpa
      ? true
      : semNum === 1 && subjects.length < DROPOUT_SUBJECT_THRESHOLD;

    students.push({
      ...base(roll),
      status: isReferred ? DiplomaResultStatus.REFERRED : DiplomaResultStatus.FAILED,
      ...(hasGpa ? parseGpas(body) : emptyGpas()),
      referredSubjects: isReferred ? subjects : [],
      failedSubjects: isReferred ? [] : subjects,
    });
  }

  return students;
}

/** Distinct rolls that start a record ("roll (" or "roll {") in the given text. */
function recordRolls(flat: string): Set<string> {
  const rolls = new Set<string>();
  for (const m of flat.matchAll(RECORD_START_RE)) rolls.add(m[1]);
  return rolls;
}

// ─── Public parse ─────────────────────────────────────────────────────────────
export async function parseResultPdf(
  buffer: Buffer,
  filename?: string,
  instituteCode: string = TARGET_INSTITUTE_CODE,
): Promise<ParseResult> {
  const hash = createHash('sha1').update(buffer).digest('hex');
  const key = `${hash}:${instituteCode}`;

  const hit = parseCache.get(key);
  if (hit) {
    console.log(`[Parser] cache hit (${hit.totalParsed} students)`);
    return hit;
  }
  const running = inflight.get(key);
  if (running) return running;

  const job = (async () => {
    const t0 = Date.now();
    const text = await extractText(buffer, hash);
    const t1 = Date.now();

    const meta = extractMeta(text, filename);
    const sliced = sliceInstitute(text, instituteCode);
    if (!sliced) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Institute ${instituteCode} not found in this PDF`,
      );
    }

    // Pass 1: cleaned text (page footers removed so split records join up)
    let students = parseChunk(cleanChunk(sliced.chunk), instituteCode, sliced.name, meta);

    // Independent completeness check on the UNCLEANED text: every "roll (" / "roll {"
    // in the institute's section must end up as a parsed student.
    const rawFlat = sliced.chunk.replace(/\s+/g, ' ');
    const expectedRolls = recordRolls(rawFlat);

    if (students.length !== expectedRolls.size) {
      // Pass 2: parse the raw text and add anything pass 1 missed
      const have = new Set(students.map((s) => s.roll));
      for (const s of parseChunk(rawFlat, instituteCode, sliced.name, meta)) {
        if (!have.has(s.roll)) students.push(s);
      }
    }

    if (students.length !== expectedRolls.size) {
      const got = new Set(students.map((s) => s.roll));
      const lost = [...expectedRolls].filter((r) => !got.has(r));
      // Never silently skip results: fail loudly instead of saving a partial import
      throw new ApiError(
        httpStatus.UNPROCESSABLE_ENTITY,
        `Parsed ${students.length} of ${expectedRolls.size} records for ${instituteCode}. ` +
          `Missing rolls: ${lost.slice(0, 20).join(', ')}`,
      );
    }

    const summary = { PASSED: 0, REFERRED: 0, FAILED: 0 };
    for (const s of students) summary[s.status as 'PASSED' | 'REFERRED' | 'FAILED']++;

    console.log(
      `[Parser] ${meta.semesterName} sem | ${meta.examYear} | reg ${meta.regulation} | ` +
        `PASSED=${summary.PASSED} REFERRED=${summary.REFERRED} FAILED=${summary.FAILED} ` +
        `TOTAL=${students.length} | extract=${t1 - t0}ms parse=${Date.now() - t1}ms`,
    );

    const result: ParseResult = { meta, totalParsed: students.length, students };
    parseCache.set(key, result);
    return result;
  })().finally(() => inflight.delete(key));

  inflight.set(key, job);
  return job;
}

// ─── DB helpers ───────────────────────────────────────────────────────────────
async function resolveSubjects(codes: string[]): Promise<Map<string, number>> {
  if (!codes.length) return new Map();
  const rows = await prisma.subject.findMany({
    where: { code: { in: codes } },
    select: { id: true, code: true },
  });
  return new Map(rows.map((s) => [s.code, s.id]));
}

async function getStudentIdMap(rolls: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  const BATCH = 5000;
  for (let i = 0; i < rolls.length; i += BATCH) {
    const rows = await prisma.student.findMany({
      where: { roll: { in: rolls.slice(i, i + BATCH) }, isDeleted: false },
      select: { id: true, roll: true },
    });
    for (const s of rows) map.set(s.roll, s.id);
  }
  return map;
}

/** One INSERT … ON CONFLICT per chunk. Adjust table/column names if your schema uses @@map/@map. */
async function bulkUpsertRaw(
  students: ParsedStudent[],
  studentIdMap: Map<string, number>,
): Promise<Map<string, number>> {
  const idByRoll = new Map<string, number>();

  for (let i = 0; i < students.length; i += RAW_CHUNK) {
    const c = students.slice(i, i + RAW_CHUNK);
    const rows = await prisma.$queryRaw<{ id: number; roll: string }[]>(Prisma.sql`
      INSERT INTO "DiplomaResult"
        (roll, status, gpa1, gpa2, gpa3, gpa4, gpa5, gpa6, gpa7,
         "semesterName", "examYear", regulation, "instituteCode", "instituteName",
         "studentId", "isDeleted", "createdAt", "updatedAt")
      SELECT roll, status::"DiplomaResultStatus", g1, g2, g3, g4, g5, g6, g7,
             sem, yr, reg, ic, iname, sid, false, now(), now()
      FROM unnest(
        ${c.map((s) => s.roll)}::text[],
        ${c.map((s) => s.status as string)}::text[],
        ${c.map((s) => s.gpa1)}::float8[], ${c.map((s) => s.gpa2)}::float8[],
        ${c.map((s) => s.gpa3)}::float8[], ${c.map((s) => s.gpa4)}::float8[],
        ${c.map((s) => s.gpa5)}::float8[], ${c.map((s) => s.gpa6)}::float8[],
        ${c.map((s) => s.gpa7)}::float8[],
        ${c.map((s) => s.semesterName)}::text[],
        ${c.map((s) => s.examYear)}::int[],
        ${c.map((s) => s.regulation)}::text[],
        ${c.map((s) => s.instituteCode)}::text[],
        ${c.map((s) => s.instituteName)}::text[],
        ${c.map((s) => studentIdMap.get(s.roll) ?? null)}::int[]
      ) AS t(roll, status, g1, g2, g3, g4, g5, g6, g7, sem, yr, reg, ic, iname, sid)
      ON CONFLICT (roll, "semesterName", "examYear", regulation) DO UPDATE SET
        status = EXCLUDED.status,
        gpa1 = EXCLUDED.gpa1, gpa2 = EXCLUDED.gpa2, gpa3 = EXCLUDED.gpa3,
        gpa4 = EXCLUDED.gpa4, gpa5 = EXCLUDED.gpa5, gpa6 = EXCLUDED.gpa6,
        gpa7 = EXCLUDED.gpa7,
        "instituteCode" = EXCLUDED."instituteCode",
        "instituteName" = EXCLUDED."instituteName",
        "studentId" = EXCLUDED."studentId",
        "isDeleted" = false,
        "updatedAt" = now()
      RETURNING id, roll
    `);
    for (const r of rows) idByRoll.set(r.roll, r.id);
  }
  return idByRoll;
}

/** Same behaviour as the original code, used only if the raw SQL path fails. */
async function fallbackUpsert(
  students: ParsedStudent[],
  studentIdMap: Map<string, number>,
): Promise<Map<string, number>> {
  const idByRoll = new Map<string, number>();

  const upsertOne = async (s: ParsedStudent) => {
    const studentId = studentIdMap.get(s.roll) ?? null;
    const data = {
      status: s.status,
      gpa1: s.gpa1, gpa2: s.gpa2, gpa3: s.gpa3, gpa4: s.gpa4,
      gpa5: s.gpa5, gpa6: s.gpa6, gpa7: s.gpa7,
      instituteCode: s.instituteCode,
      instituteName: s.instituteName,
      studentId,
      isDeleted: false,
    };
    const r = await prisma.diplomaResult.upsert({
      where: {
        roll_semesterName_examYear_regulation: {
          roll: s.roll,
          semesterName: s.semesterName,
          examYear: s.examYear,
          regulation: s.regulation,
        },
      },
      create: {
        ...data,
        roll: s.roll,
        semesterName: s.semesterName,
        examYear: s.examYear,
        regulation: s.regulation,
      },
      update: data,
      select: { id: true },
    });
    idByRoll.set(s.roll, r.id);
  };

  for (let i = 0; i < students.length; i += FALLBACK_UPSERT_CONCURRENCY) {
    await Promise.all(students.slice(i, i + FALLBACK_UPSERT_CONCURRENCY).map(upsertOne));
  }
  return idByRoll;
}

// ─── Public save ──────────────────────────────────────────────────────────────
export async function saveParsedResults(parseResult: ParseResult): Promise<SaveResult> {
  const { students } = parseResult;
  if (!students.length) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'No students parsed from PDF');
  }

  const t0 = Date.now();

  // 1. Subjects + student ids (parallel)
  const allCodes = [
    ...new Set(students.flatMap((s) => [...s.referredSubjects, ...s.failedSubjects])),
  ];
  const [subjectMap, studentIdMap] = await Promise.all([
    resolveSubjects(allCodes),
    getStudentIdMap(students.map((s) => s.roll)),
  ]);

  const missing = allCodes.filter((c) => !subjectMap.has(c));
  if (missing.length) {
    console.warn(`[DB] ${missing.length} subject code(s) missing:`, missing.slice(0, 10).join(', '));
  }

  // 2. Bulk upsert results (raw SQL, fallback to Prisma upsert)
  let idByRoll: Map<string, number>;
  try {
    idByRoll = await bulkUpsertRaw(students, studentIdMap);
  } catch (err) {
    console.warn(`[DB] raw bulk upsert failed (${(err as Error).message}). Falling back to Prisma upsert.`);
    idByRoll = await fallbackUpsert(students, studentIdMap);
  }
  console.log(`[DB] ${idByRoll.size} DiplomaResult rows upserted in ${Date.now() - t0}ms`);

  // 3. Replace subjects atomically
  const resultIds: number[] = [];
  const subjectRows: {
    diplomaResultId: number;
    subjectCode: string;
    subjectId: number | null;
    type: SubjectResultType;
  }[] = [];
  const orphanRolls: string[] = [];
  let linkedCount = 0;

  for (const s of students) {
    const id = idByRoll.get(s.roll);
    if (id === undefined) continue;
    resultIds.push(id);

    if (studentIdMap.has(s.roll)) linkedCount++;
    else orphanRolls.push(s.roll);

    for (const code of s.referredSubjects) {
      subjectRows.push({
        diplomaResultId: id,
        subjectCode: code,
        subjectId: subjectMap.get(code) ?? null,
        type: SubjectResultType.REFERRED,
      });
    }
    for (const code of s.failedSubjects) {
      subjectRows.push({
        diplomaResultId: id,
        subjectCode: code,
        subjectId: subjectMap.get(code) ?? null,
        type: SubjectResultType.FAILED,
      });
    }
  }

  const ops: Prisma.PrismaPromise<unknown>[] = [];
  for (let i = 0; i < resultIds.length; i += 10_000) {
    ops.push(
      prisma.diplomaResultSubject.deleteMany({
        where: { diplomaResultId: { in: resultIds.slice(i, i + 10_000) } },
      }),
    );
  }
  for (let i = 0; i < subjectRows.length; i += SUBJECT_CHUNK) {
    ops.push(prisma.diplomaResultSubject.createMany({ data: subjectRows.slice(i, i + SUBJECT_CHUNK) }));
  }
  await prisma.$transaction(ops);
  console.log(`[DB] ${subjectRows.length} subject rows saved | total ${Date.now() - t0}ms`);

  // 4. Cache: invalidate now, warm in background
  const rolls = students.map((s) => s.roll);
  await resultQueryService.invalidateResultCache(rolls);

  void (async () => {
    for (let i = 0; i < rolls.length; i += CACHE_WARM_CONCURRENCY) {
      await Promise.all(
        rolls
          .slice(i, i + CACHE_WARM_CONCURRENCY)
          .map((roll) => resultQueryService.getResultByRoll(roll).catch(() => null)),
      );
    }
    console.log('[Cache] warming finished');
  })();

  return {
    savedCount: idByRoll.size,
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