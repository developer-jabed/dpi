import { Request, Response } from "express";
import catchAsync from "../../shared/catchAsync";
import sendResponse from "../../shared/sendResponse";
import httpStatus from "http-status";
import pick from "../../helper/pick";
import { practicalService } from "./practical.service";
import { practicalFilterableFields, practicalPaginationFields, practicalSubmissionFilterableFields } from "./practical.constant";

// ─── Practical ───────────────────────────────────────────────────────────────

const createPractical = catchAsync(async (req: Request, res: Response) => {
  const result = await practicalService.createPractical(req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Practical created successfully",
    data: result,
  });
});

const getAllPracticals = catchAsync(async (req: Request, res: Response) => {
  const filters = pick(req.query, practicalFilterableFields);
  const options = pick(req.query, practicalPaginationFields);

  const result = await practicalService.getAllPracticals(filters as any, options as any);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Practicals retrieved successfully",
    meta: result.meta,
    data: result.data,
  });
});

const getPracticalById = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  const result = await practicalService.getPracticalById(Number(id));

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Practical retrieved successfully",
    data: result,
  });
});

const updatePractical = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  const result = await practicalService.updatePractical(Number(id), req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Practical updated successfully",
    data: result,
  });
});

const deletePractical = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  const result = await practicalService.deletePractical(Number(id));

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Practical deleted successfully",
    data: result,
  });
});

// ─── Practical Submission ────────────────────────────────────────────────────

const createSubmission = catchAsync(async (req: Request, res: Response) => {
  const result = await practicalService.createSubmission(req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Submission created successfully",
    data: result,
  });
});

const bulkCreateSubmissions = catchAsync(async (req: Request, res: Response) => {
  const result = await practicalService.bulkCreateSubmissions(req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Submissions created successfully",
    data: result,
  });
});

const getSubmissionsByPractical = catchAsync(async (req: Request, res: Response) => {
  const filters = pick(req.query, practicalSubmissionFilterableFields);
  const options = pick(req.query, practicalPaginationFields);

  const result = await practicalService.getSubmissionsByPractical(
    filters as any,
    options as any
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Submissions retrieved successfully",
    meta: result.meta,
    data: result.data,
  });
});

const updateSubmission = catchAsync(async (req: Request, res: Response) => {
  const { practicalId, studentId } = req.params;

  const result = await practicalService.updateSubmission(
    Number(practicalId),
    Number(studentId),
    req.body
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Submission updated successfully",
    data: result,
  });
});

const bulkUpdateSubmissions = catchAsync(async (req: Request, res: Response) => {
  const { practicalId } = req.params;

  const result = await practicalService.bulkUpdateSubmissions(
    Number(practicalId),
    req.body
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Submissions updated successfully",
    data: result,
  });
});

const deleteSubmission = catchAsync(async (req: Request, res: Response) => {
  const { practicalId, studentId } = req.params;

  const result = await practicalService.deleteSubmission(
    Number(practicalId),
    Number(studentId)
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Submission deleted successfully",
    data: result,
  });
});

export const practicalController = {
  createPractical,
  getAllPracticals,
  getPracticalById,
  updatePractical,
  deletePractical,
  createSubmission,
  bulkCreateSubmissions,
  getSubmissionsByPractical,
  updateSubmission,
  bulkUpdateSubmissions,
  deleteSubmission,
};