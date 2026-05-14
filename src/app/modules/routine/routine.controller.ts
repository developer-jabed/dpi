import { Request, Response } from "express";
import catchAsync from "../../shared/catchAsync";
import sendResponse from "../../shared/sendResponse";
import httpStatus from "http-status";
import { routineService } from "./routine.service";
import pick from "../../helper/pick";
import { routineFilterableFields, routinePaginationFields } from "./routine.constant";

const createRoutine = catchAsync(async (req: Request, res: Response) => {
  const result = await routineService.createRoutine(req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Class routine created successfully",
    data: result,
  });
});

const getAllRoutines = catchAsync(async (req: Request, res: Response) => {
  const filters = pick(req.query, routineFilterableFields);
  const paginationOptions = pick(req.query, routinePaginationFields);

  const result = await routineService.getAllRoutines(filters as any);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Routines retrieved successfully",
    data: result,
  });
});

const getRoutineByGroup = catchAsync(async (req: Request, res: Response) => {
  const { groupId } = req.params;
  const result = await routineService.getRoutineByGroup(Number(groupId));

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Group routine retrieved successfully",
    data: result,
  });
});

export const routineController = {
  createRoutine,
  getAllRoutines,
  getRoutineByGroup,
};