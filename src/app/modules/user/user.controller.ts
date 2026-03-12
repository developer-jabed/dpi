// user.controller.ts - Example Implementation

import { Request, Response, NextFunction } from 'express';
import catchAsync from '../../shared/catchAsync';
import sendResponse from '../../shared/sendResponse';
import { userService } from './user.service';
import { IPaginationOptions } from '../../interfaces/pagination';
import httpStatus from 'http-status';


export const createAdmin = catchAsync(
  async (req: Request, res: Response) => {
    const result = await userService.createAdmin(req);

    sendResponse(res, {
      statusCode: httpStatus.CREATED,
      success: true,
      message: 'Admin created successfully',
      data: result,
    });
  }
);


export const createCR = catchAsync(
  async (req: Request, res: Response) => {

    const result = await userService.createCR(req);

    sendResponse(res, {
      statusCode: httpStatus.CREATED,
      success: true,
      message: result.student 
        ? 'CR with Student created successfully'
        : 'CR created successfully',
      data: result,
    });
  }
);


export const createTeacher = catchAsync(
  async (req: Request, res: Response) => {
    const result = await userService.createTeacher(req);

    sendResponse(res, {
      statusCode: httpStatus.CREATED,
      success: true,
      message: 'Teacher created successfully',
      data: result,
    });
  }
);


export const createStudent = catchAsync(
  async (req: Request, res: Response) => {
    const result = await userService.createStudent(req);

    sendResponse(res, {
      statusCode: httpStatus.CREATED,
      success: true,
      message: 'Student created successfully',
      data: result,
    });
  }
);












export const userController = {
  createAdmin,
  createCR,
  createTeacher,
  createStudent,


};