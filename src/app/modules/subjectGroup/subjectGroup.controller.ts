import { Request, Response } from 'express';
import httpStatus from 'http-status';
import catchAsync from '../../shared/catchAsync';
import sendResponse from '../../shared/sendResponse';
import { subjectGroupService } from './subjectGroup.service';
import { TSubjectGroupCreate, TSubjectGroupUpdate, ISubjectGroupFilterRequest } from './subjectGroup.interface';

export const subjectGroupController = {
  createSubjectGroup: catchAsync(async (req: Request, res: Response) => {
    const payload: TSubjectGroupCreate = req.body;
    const result = await subjectGroupService.createSubjectGroup(payload);

    sendResponse(res, {
      statusCode: httpStatus.CREATED,
      success: true,
      message: 'Subject group created successfully!',
      data: result,
    });
  }),

  getSingleSubjectGroup: catchAsync(async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const result = await subjectGroupService.getSingleSubjectGroup(id);

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: 'Subject group retrieved successfully!',
      data: result,
    });
  }),

  getAllSubjectGroups: catchAsync(async (req: Request, res: Response) => {
    const filters: ISubjectGroupFilterRequest = req.query as any;
    const result = await subjectGroupService.getAllSubjectGroups(filters);

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: 'Subject groups retrieved successfully!',
      data: result,
    });
  }),

  updateSubjectGroup: catchAsync(async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const payload: TSubjectGroupUpdate = req.body;
    const result = await subjectGroupService.updateSubjectGroup(id, payload);

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: 'Subject group updated successfully!',
      data: result,
    });
  }),

  deleteSubjectGroup: catchAsync(async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const result = await subjectGroupService.deleteSubjectGroup(id);

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: 'Subject group deleted successfully!',
      data: result,

    });
  }),
};