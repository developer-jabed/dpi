// department.interface.ts

export interface TDepartmentCreate {
  name:      string;
  shortName: string;
}

export interface TDepartmentUpdate {
  name?:      string;
  shortName?: string;
}

export interface IDepartmentFilterRequest {
  searchTerm?: string;
  page?:       number;
  limit?:      number;
  sortBy?:     string;
  sortOrder?:  'asc' | 'desc';
  isDeleted?:  boolean;
}