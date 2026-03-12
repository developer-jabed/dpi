import { Prisma, Subject } from '@prisma/client';
import { Request } from 'express';

export type TSubjectCreate = {
  name: string;
  code: string;
};

export type TSubjectUpdate = Partial<TSubjectCreate>;


export interface ISubjectFilterRequest {
  searchTerm?: string;
  code?: string;
  page?: number;
  limit?: number;
  sortBy?: keyof Subject;
  sortOrder?: 'asc' | 'desc';
}


export interface SubjectRequest extends Request {
  body: TSubjectCreate | TSubjectUpdate;
}


export type SubjectResponse = Subject;