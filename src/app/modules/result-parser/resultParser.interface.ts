// resultParser.interface.ts

export type StudentStatus = 'Passed' | 'Referred' | 'Failed';
export type Semester = '1st' | '2nd' | '3rd' | '4th' | '5th' | '6th' | '7th';

export interface ExamMeta {
  semester: Semester;
  regulation: string;
  examYear: number;
}

export interface ParsedStudent {
  roll: string;
  instituteCode: string;
  instituteName: string;
  semester: Semester;
  regulation: string;
  examYear: number;
  status: StudentStatus;
  gpa1: number | null;
  gpa2: number | null;
  gpa3: number | null;
  gpa4: number | null;
  gpa5: number | null;
  gpa6: number | null;
  gpa7: number | null;
  referredSubjects: string[];
  failedSubjects: string[];
}

export interface ParseResult {
  meta: ExamMeta;
  totalParsed: number;
  students: ParsedStudent[];
}

export interface SaveResult {
  savedCount: number;
  linkedCount: number;   // saved + linked to Student model
  skippedCount: number;  // rolls not in Student — saved to DiplomaResult only
  skippedRolls: string[];
}