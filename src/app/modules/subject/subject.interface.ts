// subject.interface.ts

export interface TSubjectCreate {
  name:         string;
  shortName:    string;
  code:         string;
  credits?: number;
  semesterId:   number;
  departmentId: number;
  totalClasses?: number;
}

export interface TSubjectUpdate {
  name?:         string;
  shortName?:    string;
  code?:         string;
  semesterId?:   number;
  departmentId?: number;
  totalClasses?: number;
}

export interface ISubjectFilterRequest {
  searchTerm?:   string;
  page?:         number;
  limit?:        number;
  sortBy?:       string;
  sortOrder?:    'asc' | 'desc';
  semesterId?:   number;
  departmentId?: number;
  isDeleted?:    boolean;
}