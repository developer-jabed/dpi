import { NoticeAudienceType, NoticePriority } from "@prisma/client";


export type TNoticeCreate = {
  title: string;
  description: string;

  attachmentUrl?: string;
  noticeDate?: Date;
  expiryDate?: Date;

  isPinned?: boolean;
  isPublished?: boolean;

  priority?: NoticePriority;
  audienceType?: NoticeAudienceType;

  departmentId?: number;
  semesterId?: number;
  groupId?: number;
  studentId?: number;

  createdById?: number;
};

export type TNoticeUpdate = Partial<TNoticeCreate>;

export type INoticeFilterRequest = {
  searchTerm?: string;

  audienceType?: NoticeAudienceType;
  priority?: NoticePriority;

  departmentId?: number;
  semesterId?: number;
  groupId?: number;
  studentId?: number;

  isPinned?: boolean;
  isPublished?: boolean;
};

export type INoticeFilterItems = {
  filters: INoticeFilterRequest;
  paginationOptions: {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  };
};