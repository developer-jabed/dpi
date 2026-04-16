import { Request, Response } from "express";
import httpStatus from "http-status";
import catchAsync from "../../shared/catchAsync";
import sendResponse from "../../shared/sendResponse";
import { groupService } from "./group.service";
import pick from "../../helper/pick";

const createGroup = catchAsync(async (req: Request, res: Response) => {
  const result = await groupService.createGroup(req);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Group created successfully!",
    data: result,
  });
});

const getAllGroups = catchAsync(async (req: Request, res: Response) => {
  const filters = pick(req.query, ["searchTerm", "departmentId", "shiftId", "semesterId"]);
  const paginationOptions = pick(req.query, ["page", "limit"]);

  const result = await groupService.getAllGroups(filters, paginationOptions);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Groups with students retrieved successfully!",
    meta: result.meta,
    data: result.data,
  });
});

const getGroupById = catchAsync(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const result = await groupService.getGroupById(id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Group retrieved successfully!",
    data: result,
  });
});

export const groupController = {
  createGroup,
  getAllGroups,
  getGroupById,
};