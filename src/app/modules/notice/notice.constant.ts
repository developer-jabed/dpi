export const noticeFilterableFields = [
  "searchTerm",
  "audienceType",
  "priority",
  "departmentId",
  "semesterId",
  "groupId",
  "studentId",
  "isPinned",
  "isPublished",
];

export const noticeSearchableFields = [
  "title",
  "description",
];

export const noticeSortableFields = [
  "createdAt",
  "noticeDate",
  "priority",
];

export const noticeRelationalFields = {
  departmentId: "department",
  semesterId: "semester",
  groupId: "group",
  studentId: "student",
};