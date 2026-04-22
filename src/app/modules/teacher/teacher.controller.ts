import { Request, Response } from 'express';
import httpStatus from 'http-status';
import { teacherService } from './teacher.service';
import {
  teacherFilterableFields,
  teacherPaginationFields,
} from './teacher.constant';
import pick from '../../helper/pick';

const getAllTeachers = async (req: Request, res: Response) => {
  const filters = pick(req.query, teacherFilterableFields);
  const options = pick(req.query, teacherPaginationFields);

  const result = await teacherService.getAllTeachers(filters, options);

  res.status(httpStatus.OK).json({
    success: true,
    message: 'Teachers retrieved successfully!',
    meta: result.meta,
    data: result.data,
  });
};

const getSingleTeacher = async (req: Request, res: Response) => {
  const id = Number(req.params.id);

  const result = await teacherService.getSingleTeacher(id);

  res.status(httpStatus.OK).json({
    success: true,
    message: 'Teacher retrieved successfully!',
    data: result,
  });
};

export const teacherController = {
  getAllTeachers,
  getSingleTeacher,
};