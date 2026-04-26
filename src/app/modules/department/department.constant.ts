// department.constant.ts

export const departmentSearchableFields = [
  'name',
  'shortName',
] as const;

export const departmentSortableFields = [
  'id',
  'name',
  'shortName',
  'createdAt',
  'updatedAt',
] as const;

// ✅ All fields pick() will extract from req.query
export const departmentFilterableFields = [
  'searchTerm',
  'isDeleted',
  'sortBy',
  'sortOrder',
  'page',
  'limit',
] as const;