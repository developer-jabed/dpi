import { PracticalType } from "@prisma/client";

export interface IPracticalFilterRequest {
  searchTerm?: string;
  subjectGroupId?: number;
  type?: PracticalType;
  title?: string;
}

export interface ICreatePractical {
  subjectGroupId: number;
  title: string;
  totalMarks: number;
  type: PracticalType;
  givenDate?: Date;
  submissionDeadline?: Date;
}

export interface IUpdatePractical {
  title?: string;
  totalMarks?: number;
  type?: PracticalType;
  givenDate?: Date;
  submissionDeadline?: Date;
}

export interface ICreatePracticalSubmission {
  practicalId: number;
  studentId: number;
  obtainedMarks?: number;
  submitted?: boolean;
}

export interface IUpdatePracticalSubmission {
  obtainedMarks?: number;
  submitted?: boolean;
}

export interface IBulkCreateSubmissions {
  practicalId: number;
  studentIds: number[];
}

export interface IBulkUpdateSubmissions {
  submissions: {
    studentId: number;
    obtainedMarks?: number;
    submitted?: boolean;
  }[];
}

export interface IPracticalSubmissionFilterRequest {
  practicalId?: number;
  studentId?: number;
  submitted?: boolean;
}