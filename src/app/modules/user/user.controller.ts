import { Request, Response } from "express";
import { userService } from "./user.service";
import httpStatus from "http-status";
import catchAsync from "../../shared/catchAsync";
import sendResponse from "../../shared/sendResponse";

// Create Student
const createStudent = catchAsync(async (req: Request, res: Response) => {
  const result = await userService.createStudent(req);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Student created successfully!",
    data: result,
  });
});

// Create Teacher
const createTeacher = catchAsync(async (req: Request, res: Response) => {
  const result = await userService.createTeacher(req);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Teacher created successfully!",
    data: result,
  });
});

// Update Profile (Student or Teacher)
const updateProfile = catchAsync(async (req: Request, res: Response) => {
  const result = await userService.updateProfile(req);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Profile updated successfully!",
    data: result,
  });
});

// Optional: Create Admin (if you later add adminService)
// const createAdmin = catchAsync(async (req: Request, res: Response) => {
//   const result = await userService.createAdmin?.(req); // if implemented
//   sendResponse(res, {
//     statusCode: httpStatus.OK,
//     success: true,
//     message: "Admin created successfully!",
//     data: result,
//   });
// });

export const userController = {
  createStudent,
  createTeacher,
  updateProfile,
//   createAdmin, // optional
};
