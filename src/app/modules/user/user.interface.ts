import { Role } from "@prisma/client";

export interface IAuthUser {
  id: string;
  email: string;
  role: Role;

}

export interface IPaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}
