// subjectGroup.interface.ts

export interface TSubjectGroupCreate {
  teacherId:  number;
  subjectId:  number;
  groupId:    number;
  semesterId: number;
}

export interface TSubjectGroupUpdate {
  teacherId?:  number;
  subjectId?:  number;
  groupId?:    number;
  semesterId?: number;
}

export interface ISubjectGroupFilterRequest {
  searchTerm?: string;
  page?:       number;
  limit?:      number;
  sortBy?:     string;
  sortOrder?:  'asc' | 'desc';
  teacherId?:  number;
  subjectId?:  number;
  groupId?:    number;
  semesterId?: number;
  isDeleted?:  boolean;
}