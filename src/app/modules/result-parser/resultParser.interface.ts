import { DiplomaResultStatus } from '@prisma/client';

// ─── Exam metadata ────────────────────────────────────────────────────────────

export interface ExamMeta {
  /** Normalized semester label, e.g. "1st" | "3rd" | "7th" */
  semesterName: string;
  /** Full exam year, e.g. 2024 */
  examYear: number;
  /** Regulation year string, e.g. "2022" | "Unknown" */
  regulation: string;
}

// ─── Single parsed student ────────────────────────────────────────────────────

export interface ParsedStudent {
  roll: string;
  instituteCode: string;
  instituteName: string;
  semesterName: string;
  examYear: number;
  regulation: string;

  status: DiplomaResultStatus;

  /** Current semester GPA (always present for PASSED / REFERRED) */
  gpa3: number | null;
  /** Previous semester GPA */
  gpa2: number | null;
  /** Two semesters ago */
  gpa1: number | null;
  /** Extended slots for higher-semester results */
  gpa4: number | null;
  gpa5: number | null;
  gpa6: number | null;
  gpa7: number | null;

  /** Subject codes the student is referred in, e.g. ["66711"] */
  referredSubjects: string[];
  /** Subject codes the student failed in (FAILED status only) */
  failedSubjects: string[];
}

// ─── Return types ─────────────────────────────────────────────────────────────

export interface ParseResult {
  meta: ExamMeta;
  totalParsed: number;
  students: ParsedStudent[];
  
}

export interface SaveResult {
  /** Total records upserted (created or updated) */
  savedCount: number;
  /** Records matched to an existing Student row */
  linkedCount: number;
  /** Records with no Student match — stored with null studentId / groupId */
  orphanCount: number;
  /** Always 0 — upsert never silently drops a record */
  skippedCount: number;
  /** Roll numbers that had no Student match */
  orphanRolls: string[];
}