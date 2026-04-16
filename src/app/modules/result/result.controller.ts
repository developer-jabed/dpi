import { Request, Response } from 'express';
import httpStatus from 'http-status';
import catchAsync from '../../shared/catchAsync';
import sendResponse from '../../shared/sendResponse';
import { resultService } from './result.service';
import { resultFilterableFields } from './result.constant';
import pick from '../../helper/pick';

// 🔹 GET SINGLE RESULT
const getResultByRoll = catchAsync(async (req: Request, res: Response) => {
  const { roll } = req.params;

  const result = await resultService.getResultByRoll(roll as string);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Result retrieved successfully',
    data: result,
  });
});

// 🔹 GET ALL RESULTS (FILTER + PAGINATION)
const getAllResults = catchAsync(async (req: Request, res: Response) => {
  const filters = pick(req.query, resultFilterableFields);
  const paginationOptions = pick(req.query, [
    'page',
    'limit',
    'sortBy',
    'sortOrder',
  ]);

  const result = await resultService.getAllResults({
    filters,
    paginationOptions,
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Results retrieved successfully',
    meta: result.meta,
    data: result.data,
  });
});

export const resultController = {
  getResultByRoll,
  getAllResults,
};