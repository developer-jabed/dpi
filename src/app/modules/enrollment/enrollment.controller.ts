import { Request, Response } from "express";
import httpStatus from "http-status";
import catchAsync from "../../shared/catchAsync";
import sendResponse from "../../shared/sendResponse";
import { enrollmentService } from "./enrollment.service";

const promoteBatch = catchAsync(async (req, res) => {
  const result = await enrollmentService.promoteBatch(req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Batch promoted successfully",
    data: result,
  });
});

const promoteSingleStudent = catchAsync(async (req: Request, res: Response) => {
  const result = await enrollmentService.promoteSingleStudent(req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Student enrollment updated successfully",
    data: result,
  });
});

const applyResult = catchAsync(async (req: Request, res: Response) => {
  const { diplomaResultId } = req.body;
  const result = await enrollmentService.applyDiplomaResult(diplomaResultId);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message:
      result.action === "PASSED"
        ? "Result applied — student passed this semester"
        : "Result applied — student flagged for retake and rolled back",
    data: result,
  });
});

const getActiveEnrollment = catchAsync(async (req: Request, res: Response) => {
  const studentId = Number(req.params.studentId);
  const result = await enrollmentService.getActiveEnrollment(studentId);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Active enrollment retrieved successfully",
    data: result,
  });
});

const getEnrollmentHistory = catchAsync(async (req: Request, res: Response) => {
  const studentId = Number(req.params.studentId);
  const result = await enrollmentService.getEnrollmentHistory(studentId);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Enrollment history retrieved successfully",
    data: result,
  });
});

export const enrollmentController = {
  promoteBatch,
  promoteSingleStudent,
  applyResult,
  getActiveEnrollment,
  getEnrollmentHistory,
};