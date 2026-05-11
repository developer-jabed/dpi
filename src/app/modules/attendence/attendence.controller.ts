import { Request, Response } from "express";
import catchAsync from "../../shared/catchAsync";
import sendResponse from "../../shared/sendResponse";
import httpStatus from "http-status";
import { attendanceService } from "./attendence.service";
import { attendanceSessionFilterableFields, attendanceSessionPaginationFields } from "./attendence.constant";
import pick from "../../helper/pick";


const createSessionWithRecords = catchAsync(
  async (req: Request, res: Response) => {
    const result = await attendanceService.createSessionWithRecords(req.body);
    sendResponse(res, {
      statusCode: httpStatus.CREATED,
      success: true,
      message: "Attendance session created successfully",
      data: result,
    });
  }
);

const getAllSessions = catchAsync(async (req: Request, res: Response) => {
  const filters = pick(req.query, attendanceSessionFilterableFields);
  const options = pick(req.query, attendanceSessionPaginationFields);

  const result = await attendanceService.getAllSessions(filters as any, options as any);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Attendance sessions retrieved successfully",
    meta: result.meta,
    data: result.data,
  });
});

const getSessionById = catchAsync(async (req: Request, res: Response) => {
  const result = await attendanceService.getSessionById(Number(req.params.id));
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Attendance session retrieved successfully",
    data: result,
  });
});

const deleteSession = catchAsync(async (req: Request, res: Response) => {
  const result = await attendanceService.deleteSession(Number(req.params.id));
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Attendance session deleted successfully",
    data: result,
  });
});

const updateSessionRecords = catchAsync(async (req: Request, res: Response) => {
  const result = await attendanceService.updateSessionRecords(
    Number(req.params.id),
    req.body.records
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Attendance records updated successfully",
    data: result,
  });
});

const getStudentAttendanceBySemester = catchAsync(
  async (req: Request, res: Response) => {
    const { studentId, semesterId } = req.params;
    const result = await attendanceService.getStudentAttendanceBySemester(
      Number(studentId),
      Number(semesterId)
    );
    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Student attendance retrieved successfully",
      data: result,
    });
  }
);

export const attendanceController = {
  createSessionWithRecords,
  getAllSessions,
  getSessionById,
  deleteSession,
  updateSessionRecords,
  getStudentAttendanceBySemester,
};