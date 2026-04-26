
// shift.controller.ts

import { Request, Response } from 'express';
import catchAsync from '../../shared/catchAsync';
import sendResponse from '../../shared/sendResponse';
import httpStatus from 'http-status';
import { shiftService } from './shift.service';
import pick from '../../helper/pick';
import { shiftFilterableFields } from './shift.constant';

const createShift = catchAsync(async (req: Request, res: Response) => {
  const result = await shiftService.createShift(req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success:    true,
    message:    'Shift created successfully',
    data:       result,
  });
});

const getAllShifts = catchAsync(async (req: Request, res: Response) => {
  const filters = pick(req.query, shiftFilterableFields);

  const result = await shiftService.getAllShifts(filters);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success:    true,
    message:    'Shifts retrieved successfully',
    meta:       result.meta,
    data:       result.data,
  });
});

const getSingleShift = catchAsync(async (req: Request, res: Response) => {
  const id     = Number(req.params.id);
  const result = await shiftService.getSingleShift(id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success:    true,
    message:    'Shift retrieved successfully',
    data:       result,
  });
});

const updateShift = catchAsync(async (req: Request, res: Response) => {
  const id     = Number(req.params.id);
  const result = await shiftService.updateShift(id, req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success:    true,
    message:    'Shift updated successfully',
    data:       result,
  });
});

const deleteShift = catchAsync(async (req: Request, res: Response) => {
  const id     = Number(req.params.id);
  const result = await shiftService.deleteShift(id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success:    true,
    message:    'Shift deleted successfully',
    data:       result,
  });
});

export const shiftController = {
  createShift,
  getAllShifts,
  getSingleShift,
  updateShift,
  deleteShift,
};