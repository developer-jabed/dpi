// src/app/modules/subjectGroup/subjectGroup.interface.ts

export interface TSubjectGroupCreate {
  subjectId: number;
  groupId: number;
  teacherId?: number | null;
}

export interface TSubjectGroupUpdate {
  subjectId?: number;
  groupId?: number;
  teacherId?: number | null;
}

export interface ISubjectGroupFilterRequest {
  searchTerm?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}