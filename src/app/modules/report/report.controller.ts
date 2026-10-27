import { Request, Response } from "express";
import catchAsync from "../../shared/catchAsync";
import sendResponse from "../../shared/sendResponse";
import httpStatus from "http-status";
import { reportService } from "./report.service";
import ApiError from "../../errors/api.error";

const getMyStudentReports = catchAsync(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "You are not authorized!");
  }

  const filters = {
    subjectGroupId: req.query.subjectGroupId
      ? Number(req.query.subjectGroupId)
      : undefined,
    groupId: req.query.groupId ? Number(req.query.groupId) : undefined,
  };

  const result = await reportService.getTeacherStudentReports(
    Number(req.user.id),
    filters
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Student reports retrieved successfully",
    data: result,
  });
});

const getStudentReport = catchAsync(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "You are not authorized!");
  }

  const { subjectGroupId, studentId } = req.params;

  const result = await reportService.getStudentReportBySubjectGroup(
    Number(req.user.id),
    Number(subjectGroupId),
    Number(studentId)
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Student report retrieved successfully",
    data: result,
  });
});

export const reportController = {
  getMyStudentReports,
  getStudentReport,
};