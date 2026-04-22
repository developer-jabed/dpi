// src/app/modules/student/student.controller.ts

import { Request, Response } from 'express';
import httpStatus from 'http-status';
import catchAsync from '../../shared/catchAsync';
import sendResponse from '../../shared/sendResponse';
import { studentService } from './student.service';
import pick from '../../helper/pick';
import { studentFilterableFields, studentPaginationFields } from './student.constant';

export const studentController = {

  // ========================= GET ALL STUDENTS =========================
  getAllStudents: catchAsync(async (req: Request, res: Response) => {
    const filters = pick(req.query as Record<string, unknown>, [
      ...studentFilterableFields,
    ]);

    const paginationOptions = pick(req.query as Record<string, unknown>, [
      ...studentPaginationFields,
    ]);

    const result = await studentService.getAllStudents(
      filters as any,
      paginationOptions,
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: 'Students retrieved successfully',
      meta: result.meta,
      data: result.data,
    });
  }),

  // ========================= GET STUDENT BY ID =========================
  getStudentById: catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;

    const result = await studentService.getStudentById(Number(id));

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: 'Student retrieved successfully',
      data: result,
    });
  }),

  // ========================= UPDATE STUDENT =========================
  updateStudent: catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const payload = req.body;

    const result = await studentService.updateStudent(Number(id), payload);

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: 'Student updated successfully',
      data: result,
    });
  }),

  // ========================= SOFT DELETE =========================
  softDeleteStudent: catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;

    const result = await studentService.softDeleteStudent(Number(id));

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: 'Student deleted successfully',
      data: result,
    });
  }),
};