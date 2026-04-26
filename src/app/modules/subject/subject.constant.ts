// subject.constant.ts

export const subjectSearchableFields = [
  'name',
  'shortName',
  'code',
] as const;

export const subjectSortableFields = [
  'id',
  'name',
  'shortName',
  'code',
  'totalClasses',
  'createdAt',
  'updatedAt',
] as const;