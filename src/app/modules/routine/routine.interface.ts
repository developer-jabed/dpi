
import { ClassRoutine } from '@prisma/client';

export type ICreateRoutine = {
  groupId: number;
  subjectGroupId: number;
  dayOfWeek: number;
  period: number;
  startTime: string;
  endTime: string;
  room?: string;
};

export type IUpdateRoutine = Partial<ICreateRoutine>;

export type IRoutineFilterRequest = {
  searchTerm?: string;
  groupId?: number;
  dayOfWeek?: number;
  semesterId?: number;
};

export type IRoutineResponse = ClassRoutine & {
  subjectGroup?: {
    subject: { id: number; name: string; code: string };
    teacher: { id: number; name: string };
  };
  group?: {
    id: number;
    name: string;
    session: string;
    currentSemester?: { name: string };
  };
};