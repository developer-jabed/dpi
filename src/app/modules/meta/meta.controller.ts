import { Request, Response } from "express";
import httpStatus from "http-status";
import catchAsync from "../../shared/catchAsync";
import sendResponse from "../../shared/sendResponse";
import { dashboardService } from "./meta.service";

const getAdminDashboard = catchAsync(async (req: Request, res: Response) => {
  const result = await dashboardService.getAdminDashboard();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Admin dashboard retrieved successfully",
    data: result,
  });
});

const getTeacherDashboard = catchAsync(async (req: Request, res: Response) => {
  const userId = Number(req.user?.id);

  const result = await dashboardService.getTeacherDashboard(userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Teacher dashboard retrieved successfully",
    data: result,
  });
});

const getStudentDashboard = catchAsync(async (req: Request, res: Response) => {
  const userId = Number(req.user?.id);

  const result = await dashboardService.getStudentDashboard(userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Student dashboard retrieved successfully",
    data: result,
  });
});

export const dashboardController = {
  getAdminDashboard,
  getTeacherDashboard,
  getStudentDashboard,
};
