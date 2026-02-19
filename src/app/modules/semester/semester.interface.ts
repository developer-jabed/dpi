export interface ISemester {
  semesterNo: number;
  departmentId: number;
  shiftId: number;
}

export interface ISemesterFilters {
  searchTerm?: string;
  departmentId?: number;
  shiftId?: number;
}
