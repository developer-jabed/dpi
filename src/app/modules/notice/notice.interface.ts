import { NoticeAudienceType, NoticePriority } from "@prisma/client";

// ─────────────────────────────────────────────────────────────
// Viewer Context Types
// ─────────────────────────────────────────────────────────────

export interface IStudentContext {
  role: "student";
  studentId: number;
  groupId?: number;
  semesterId?: number;
  departmentId?: number;
}

export interface ITeacherContext {
  role: "teacher";
  teacherId: number;
  departmentId?: number;
}

export interface IGroupContext {
  role: "group";
  groupId: number;
  semesterId?: number;
  departmentId?: number;
}

export type IViewerContext = IStudentContext | ITeacherContext | IGroupContext;

// ─────────────────────────────────────────────────────────────
// Create / Update
// ─────────────────────────────────────────────────────────────

export type TNoticeCreate = {
  title: string;
  description: string;

  attachmentUrl?: string;
  noticeDate?: Date | string;
  expiryDate?: Date | string;

  isPinned?: boolean;
  isPublished?: boolean;

  priority?: NoticePriority;
  audienceType?: NoticeAudienceType;

  departmentId?: number;
  semesterId?: number;
  groupId?: number;
  studentId?: number;
  teacherId?: number;

  createdById?: number;
};

export type TNoticeUpdate = Partial<Omit<TNoticeCreate, "createdById">>;

// ─────────────────────────────────────────────────────────────
// Filter Request (backend — allows string booleans from query)
// ─────────────────────────────────────────────────────────────

export type INoticeFilterRequest = {
  searchTerm?: string;

  audienceType?: NoticeAudienceType;
  priority?: NoticePriority;

  departmentId?: number;
  semesterId?: number;
  groupId?: number;
  studentId?: number;
  teacherId?: number;

  isPinned?: boolean | string;
  isPublished?: boolean | string;
};

// ─────────────────────────────────────────────────────────────
// Filter Items (combined filters + pagination)
// ─────────────────────────────────────────────────────────────

export type INoticeFilterItems = {
  filters: INoticeFilterRequest;
  paginationOptions: {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  };
  viewerContext?: IViewerContext;
};
