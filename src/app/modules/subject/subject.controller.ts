import { Request, Response } from 'express';
import httpStatus from 'http-status';
import catchAsync from '../../shared/catchAsync';
import sendResponse from '../../shared/sendResponse';
import { subjectService } from './subject.service';
import ApiError from '../../errors/api.error';



const createSubject = catchAsync(async (req: Request, res: Response) => {

  const result = await subjectService.createSubject(req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Subject created successfully!',
    data: result,
  });
});

const getAllSubjects = catchAsync(async (req: Request, res: Response) => {
  const result = await subjectService.getAllSubjects(req.query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Subjects retrieved successfully!",
    meta: result.meta,
    data: result.data,
  });
});

const getSingleSubject = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await subjectService.getSingleSubject(Number(id));

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Subject retrieved successfully!',
    data: result,
  });
});

const getGroupedBooks = catchAsync(async (req: Request, res: Response) => {
  const result = await subjectService.getSubjectsGroupedBySemester({
    departmentId: req.query.departmentId as string | undefined,
    searchTerm: req.query.searchTerm as string | undefined,
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Semester-wise book list retrieved',
    data: result,
  });
});

const getBooksBySemester = catchAsync(async (req: Request, res: Response) => {
  const semesterId = Number(req.params.semesterId);

  if (Number.isNaN(semesterId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid semester id');
  }

  const result = await subjectService.getSubjectsBySemester(semesterId, {
    departmentId: req.query.departmentId as string | undefined,
    searchTerm: req.query.searchTerm as string | undefined,
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Semester books retrieved',
    data: result,
  });
});

const updateSubject = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await subjectService.updateSubject(Number(id), req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Subject updated successfully!',
    data: result,
  });
});



export const subjectController = {
  createSubject,
  getAllSubjects,
  getSingleSubject,
  getGroupedBooks,
  getBooksBySemester,

  updateSubject,

};