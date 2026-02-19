import { Request, Response } from "express";
import catchAsync from "../../shared/catchAsync";
import sendResponse from "../../shared/sendResponse";
import httpStatus from "http-status";
import { userService } from "./user.service";
import { userFilterableFields } from "./user.constant";
import pick from "../../helper/pick";

const createAdmin = catchAsync(async (req: Request, res: Response) => {
  const result = await userService.createAdmin(req);
  sendResponse(res, { statusCode: httpStatus.OK, success: true, message: "Admin created successfully!", data: result });
});

const createCR = catchAsync(async (req: Request, res: Response) => {
  const result = await userService.createCR(req);
  sendResponse(res, { statusCode: httpStatus.OK, success: true, message: "CR created successfully!", data: result });
});

const createTeacher = catchAsync(async (req: Request, res: Response) => {
  const result = await userService.createTeacher(req);
  sendResponse(res, { statusCode: httpStatus.OK, success: true, message: "Teacher created successfully!", data: result });
});

const createStudent = catchAsync(async (req: Request, res: Response) => {
  const result = await userService.createStudent(req);
  sendResponse(res, { statusCode: httpStatus.OK, success: true, message: "Student created successfully!", data: result });
});

const getAllFromDB = catchAsync(async (req: Request, res: Response) => {
  const filters = pick(req.query, userFilterableFields);
  const options = pick(req.query, ['limit', 'page', 'sortBy', 'sortOrder']);
  const result = await userService.getAllFromDB(filters, options);
  sendResponse(res, { statusCode: httpStatus.OK, success: true, message: "Users fetched successfully!", meta: result.meta, data: result.data });
});

// const updateProfile = catchAsync(async (req: Request , res: Response) => {
//   // const user = req.user!;
//   const result = await userService.updateProfile(user.id, req);
//   sendResponse(res, { statusCode: httpStatus.OK, success: true, message: "Profile updated successfully!", data: result });
// });

export const userController = {
  createAdmin,
  createCR,
  createTeacher,
  createStudent,
  getAllFromDB,
  // updateProfile,
};
