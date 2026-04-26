// shift.constant.ts  — add this

export const shiftSearchableFields = [
  'name',
  'shortName',
] as const;

export const shiftSortableFields = [
  'id',
  'name',
  'shortName',
  'createdAt',
  'updatedAt',
] as const;

// ✅ All fields pick() will extract from req.query
export const shiftFilterableFields = [
  'searchTerm',
  'departmentId',
  'isDeleted',
  'sortBy',
  'sortOrder',
  'page',
  'limit',
] as const;