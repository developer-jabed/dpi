import { Role, UserStatus } from '@prisma/client';

export interface IAuthUser {
  id: string;
  email: string;
  role: Role;
  status: UserStatus;
}

export interface IPaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}
