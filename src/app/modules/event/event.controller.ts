import { Request, Response } from "express";
import catchAsync from "../../shared/catchAsync";
import sendResponse from "../../shared/sendResponse";
import httpStatus from "http-status";
import pick from "../../helper/pick";
import { eventService } from "./event.service";
import {
  eventFilterableFields,
  eventPaginationFields,
} from "./event.constant";

const createEvent = catchAsync(async (req: Request, res: Response) => {
  const result = await eventService.createEvent(req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Event created successfully",
    data: result,
  });
});

const getAllEvents = catchAsync(async (req: Request, res: Response) => {
  const filters = pick(req.query, eventFilterableFields);
  const options = pick(req.query, eventPaginationFields);

  const result = await eventService.getAllEvents(filters, options);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Events fetched successfully",
    meta: result.meta,
    data: result.data,
  });
});

const getEventById = catchAsync(async (req: Request, res: Response) => {
  const result = await eventService.getEventById(Number(req.params.id));

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Event fetched successfully",
    data: result,
  });
});

const getFeaturedEvents = catchAsync(async (_req: Request, res: Response) => {
  const result = await eventService.getFeaturedEvents();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Featured events fetched successfully",
    data: result,
  });
});

const updateEvent = catchAsync(async (req: Request, res: Response) => {
  const result = await eventService.updateEvent(Number(req.params.id), req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Event updated successfully",
    data: result,
  });
});

const toggleFeatured = catchAsync(async (req: Request, res: Response) => {
  const result = await eventService.toggleFeatured(Number(req.params.id));

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Event featured status toggled successfully",
    data: result,
  });
});

const deleteEvent = catchAsync(async (req: Request, res: Response) => {
  const result = await eventService.deleteEvent(Number(req.params.id));

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Event deleted successfully",
    data: result,
  });
});

export const eventController = {
  createEvent,
  getAllEvents,
  getEventById,
  getFeaturedEvents,
  updateEvent,
  toggleFeatured,
  deleteEvent,
};