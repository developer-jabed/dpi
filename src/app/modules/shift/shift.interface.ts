// shift.interface.ts

export interface TShiftCreate {
  name:         string;
  shortName:    string;
  departmentId: number;
}

export interface TShiftUpdate {
  name?:         string;
  shortName?:    string;
  departmentId?: number;
}

export interface IShiftFilterRequest {
  searchTerm?:   string;
  page?:         number;
  limit?:        number;
  sortBy?:       string;
  sortOrder?:    'asc' | 'desc';
  departmentId?: number;
  isDeleted?:    boolean;
}