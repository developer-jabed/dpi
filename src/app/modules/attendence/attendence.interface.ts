import { AttendanceStatus, TakenByRole } from "@prisma/client";

export interface ICreateAttendanceSession {
  groupId: number;
  semesterId: number;
  subjectId: number;
  teacherId?: number;
  crStudentId?: number;
  takenByRole: TakenByRole;
  date: string | Date;
}

export interface IAttendanceRecord {
  studentId: number;
  status: AttendanceStatus;
}

export interface ICreateAttendanceWithRecords {
  session: ICreateAttendanceSession;
  records: IAttendanceRecord[];
}

export interface IUpdateAttendanceRecord {
  studentId: number;
  status: AttendanceStatus;
}

export interface IAttendanceSessionFilterRequest {
  groupId?: number;
  semesterId?: number;
  subjectId?: number;
  teacherId?: number;
  crStudentId?: number;
  takenByRole?: TakenByRole;
  date?: string;
}