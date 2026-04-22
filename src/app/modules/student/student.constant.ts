// src/app/modules/student/student.constants.ts

export const studentFilterableFields = [
  'searchTerm',
  'departmentId',
  'groupId',
  'gender',
  'isDeleted',
] as const;

export const studentSearchableFields = [
  'name',
  'email',
  'roll',
  'registration',
  'mobile',
];

export const studentPaginationFields = [
  'page',
  'limit',
  'sortBy',
  'sortOrder',
] as const;

export const studentSelectedFields = {
  id: true,
  name: true,
  email: true,
  roll: true,
  registration: true,
  mobile: true,
  gender: true,
  birthDate: true,
  birthnumber: true,
  nid: true,
  fatherName: true,
  motherName: true,
  fatherMobile: true,
  motherMobile: true,
  presentAddress: true,
  permanentAddress: true,
  profilePhoto: true,
  isDeleted: true,
  createdAt: true,
  updatedAt: true,
  group: {
    select: {
      id: true,
      name: true,
    },
  },
  department: {
    select: {
      id: true,
      name: true,
    },
  },
  user: {
    select: {
      id: true,
      email: true,
      role: true,
    },
  },
};