import { Request, Response } from "express";
import catchAsync from "../../shared/catchAsync";
import sendResponse from "../../shared/sendResponse";
import httpStatus from "http-status";
import ApiError from "../../errors/api.error";
import { overviewService } from "./myOverview.service";

const getMyOverview = catchAsync(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "You are not authorized!");
  }

  const result = await overviewService.getMyOverview({
    userId: Number(req.user.id),
    role: req.user.role,
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Overview retrieved successfully",
    data: result,
  });
});

export const overviewController = {
  getMyOverview,
};