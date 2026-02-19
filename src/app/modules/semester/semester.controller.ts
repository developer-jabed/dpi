import { Request, Response } from "express";
import catchAsync from "../../shared/catchAsync";
import sendResponse from "../../shared/sendResponse";
import httpStatus from "http-status";
import { semesterService } from "./semester.service";

const createSemester = catchAsync(async (req: Request, res: Response) => {
  const result = await semesterService.createSemester(req);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Semester created successfully",
    data: result,
  });
});

const getAllSemesters = catchAsync(async (req: Request, res: Response) => {
  const result = await semesterService.getAllSemesters(req);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Semesters retrieved successfully",
    meta: result.meta,
    data: result.data,
  });
});

const getSemesterById = catchAsync(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const result = await semesterService.getSemesterById(id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Semester retrieved successfully",
    data: result,
  });
});

export const semesterController = {
  createSemester,
  getAllSemesters,
  getSemesterById,
};
