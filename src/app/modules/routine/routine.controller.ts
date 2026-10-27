import { Request, Response } from "express";
import catchAsync from "../../shared/catchAsync";
import sendResponse from "../../shared/sendResponse";
import httpStatus from "http-status";
import { routineService } from "./routine.service";
import pick from "../../helper/pick";
import {
  routineFilterableFields,
  routinePaginationFields,
} from "./routine.constant";
import { prisma } from "../../shared/prisma";
import ApiError from "../../errors/api.error";

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

const getMyRoutines = catchAsync(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "You are not authorized!");
  }

  const result = await routineService.getMyRoutines({
    userId: Number(req.user.id),   // id is string in your JWT
    role: req.user.role,
  });

  console.log(result)


  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "My routine retrieved successfully",
    data: result,
  });
});

export const routineController = {
  createRoutine,
  getAllRoutines,
  getRoutineByGroup,
  getMyRoutines,
};