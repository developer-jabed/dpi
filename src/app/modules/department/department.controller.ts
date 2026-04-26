// department.controller.ts

import { Request, Response } from 'express';
import catchAsync from '../../shared/catchAsync';
import sendResponse from '../../shared/sendResponse';
import { departmentService } from './department.service';
import httpStatus from 'http-status';
import pick from '../../helper/pick';
import { departmentFilterableFields } from './department.constant';

const createDepartment = catchAsync(async (req: Request, res: Response) => {
  const result = await departmentService.createDepartment(req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Department created successfully!',
    data: result,
  });
});

const getAllDepartments = catchAsync(async (req: Request, res: Response) => {
  const filters = pick(req.query, [...departmentFilterableFields]);

  const result = await departmentService.getAllDepartments(filters);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Departments fetched successfully!',
    meta: result.meta,
    data: result.data,
  });
});

const getSingleDepartment = catchAsync(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const result = await departmentService.getSingleDepartment(id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Department fetched successfully!',
    data: result,
  });
});

const updateDepartment = catchAsync(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const result = await departmentService.updateDepartment(id, req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Department updated successfully!',
    data: result,
  });
});

const deleteDepartment = catchAsync(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const result = await departmentService.deleteDepartment(id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Department deleted successfully!',
    data: result,
  });
});

export const departmentController = {
  createDepartment,
  getAllDepartments,
  getSingleDepartment,
  updateDepartment,
  deleteDepartment,
};