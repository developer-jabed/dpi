import { Request, Response } from "express";
import catchAsync from "../../shared/catchAsync";
import sendResponse from "../../shared/sendResponse";
import httpStatus from "http-status";
import { shiftService } from "./shift.service";

const createShift = catchAsync(async (req: Request, res: Response) => {
  const result = await shiftService.createShift(req);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Shift created successfully",
    data: result,
  });
});

const getAllShifts = catchAsync(async (req: Request, res: Response) => {
  const result = await shiftService.getAllShifts(req);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Shifts retrieved successfully",
    meta: result.meta,
    data: result.data,
  });
});

const getShiftById = catchAsync(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const result = await shiftService.getShiftById(id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Shift retrieved successfully",
    data: result,
  });
});

export const shiftController = {
  createShift,
  getAllShifts,
  getShiftById,
};
