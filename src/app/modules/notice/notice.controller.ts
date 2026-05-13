import { Request, Response } from "express";
import httpStatus from "http-status";

import catchAsync from "../../shared/catchAsync";
import sendResponse from "../../shared/sendResponse";
import pick from "../../helper/pick";

import { noticeService } from "./notice.service";

import { noticeFilterableFields } from "./notice.constant";
import { IViewerContext } from "./notice.interface";

const createNotice = catchAsync(async (req: Request, res: Response) => {
  const result = await noticeService.createNotice(req.body);

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.CREATED,
    message: "Notice created successfully",
    data: result,
  });
});

const getAllNotices = catchAsync(async (req: Request, res: Response) => {
  const filters = pick(req.query, noticeFilterableFields);

  const options = pick(req.query, ["limit", "page", "sortBy", "sortOrder"]);

  // ── Resolve viewer context from query params ────────────
  let viewerContext: IViewerContext | undefined;

  const { viewerRole } = req.query;

  if (viewerRole === "student" && req.query.studentId) {
    viewerContext = {
      role: "student",
      studentId: Number(req.query.studentId),
      groupId: req.query.groupId ? Number(req.query.groupId) : undefined,
      semesterId: req.query.semesterId
        ? Number(req.query.semesterId)
        : undefined,
      departmentId: req.query.departmentId
        ? Number(req.query.departmentId)
        : undefined,
    };
  } else if (viewerRole === "teacher" && req.query.teacherId) {
    viewerContext = {
      role: "teacher",
      teacherId: Number(req.query.teacherId),
      departmentId: req.query.departmentId
        ? Number(req.query.departmentId)
        : undefined,
    };
  } else if (viewerRole === "group" && req.query.groupId) {
    viewerContext = {
      role: "group",
      groupId: Number(req.query.groupId),
      semesterId: req.query.semesterId
        ? Number(req.query.semesterId)
        : undefined,
      departmentId: req.query.departmentId
        ? Number(req.query.departmentId)
        : undefined,
    };
  }

  const result = await noticeService.getAllNotices(
    filters,
    options,
    viewerContext,
  );

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Notices retrieved successfully",
    meta: result.meta,
    data: result.data,
  });
});

const getSingleNotice = catchAsync(async (req: Request, res: Response) => {
  const result = await noticeService.getSingleNotice(Number(req.params.id));

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Notice retrieved successfully",
    data: result,
  });
});

const updateNotice = catchAsync(async (req: Request, res: Response) => {
  const result = await noticeService.updateNotice(
    Number(req.params.id),
    req.body,
  );

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Notice updated successfully",
    data: result,
  });
});

const deleteNotice = catchAsync(async (req: Request, res: Response) => {
  const result = await noticeService.deleteNotice(Number(req.params.id));

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Notice deleted successfully",
    data: result,
  });
});

export const noticeController = {
  createNotice,
  getAllNotices,
  getSingleNotice,
  updateNotice,
  deleteNotice,
};
