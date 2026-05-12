import { Event, Prisma } from "@prisma/client";
import { prisma } from "../../shared/prisma";
import ApiError from "../../errors/api.error";
import httpStatus from "http-status";
import { IPaginationOptions } from "../../interfaces/pagination";
import { paginationHelper } from "../../helper/paginationHelper";
import {
  ICreateEvent,
  IEventFilterRequest,
  IUpdateEvent,
} from "./event.interface";
import { eventSearchableFields } from "./event.constant";

const createEvent = async (payload: ICreateEvent): Promise<Event> => {
  const event = await prisma.event.create({
    data: {
      title: payload.title,
      description: payload.description,
      photoUrl: payload.photoUrl ?? null,
      eventLinks: payload.eventLinks ?? [],
      driveLink: payload.driveLink ?? null,
      eventType: payload.eventType ?? "OTHER",
      location: payload.location ?? null,
      eventDate: payload.eventDate ? new Date(payload.eventDate) : null,
      isFeatured: payload.isFeatured ?? false,
      createdById: payload.createdById ?? null,
    },
    include: { createdBy: true },
  });

  return event;
};

const getAllEvents = async (
  filters: IEventFilterRequest,
  options: IPaginationOptions
) => {
  const { limit, page, skip, sortBy, sortOrder } =
    paginationHelper.calculatePagination(options);

  const { search, isFeatured, fromDate, toDate, ...filterData } = filters;

  const andConditions: Prisma.EventWhereInput[] = [];

  if (search) {
    andConditions.push({
      OR: eventSearchableFields.map((field) => ({
        [field]: { contains: search, mode: "insensitive" },
      })),
    });
  }

  if (isFeatured !== undefined) {
    andConditions.push({
      isFeatured: isFeatured === true || isFeatured === "true",
    });
  }

  if (fromDate || toDate) {
    andConditions.push({
      eventDate: {
        ...(fromDate ? { gte: new Date(fromDate) } : {}),
        ...(toDate ? { lte: new Date(toDate) } : {}),
      },
    });
  }

  if (Object.keys(filterData).length > 0) {
    andConditions.push({
      AND: Object.keys(filterData).map((key) => ({
        [key]: { equals: (filterData as Record<string, unknown>)[key] },
      })),
    });
  }

  const whereConditions: Prisma.EventWhereInput =
    andConditions.length > 0 ? { AND: andConditions } : {};

  const [result, total] = await Promise.all([
    prisma.event.findMany({
      where: whereConditions,
      skip,
      take: limit,
      orderBy: { [sortBy ?? "createdAt"]: sortOrder ?? "desc" },
      include: { createdBy: true },
    }),
    prisma.event.count({ where: whereConditions }),
  ]);

  return {
    meta: { page, limit, total },
    data: result,
  };
};

const getEventById = async (id: number): Promise<Event> => {
  const event = await prisma.event.findUnique({
    where: { id },
    include: { createdBy: true },
  });

  if (!event) {
    throw new ApiError(httpStatus.NOT_FOUND, "Event not found");
  }

  return event;
};

const getFeaturedEvents = async (): Promise<Event[]> => {
  return prisma.event.findMany({
    where: { isFeatured: true },
    orderBy: { eventDate: "asc" },
    include: { createdBy: true },
  });
};

const updateEvent = async (
  id: number,
  payload: IUpdateEvent
): Promise<Event> => {
  const existing = await prisma.event.findUnique({ where: { id } });

  if (!existing) {
    throw new ApiError(httpStatus.NOT_FOUND, "Event not found");
  }

  const event = await prisma.event.update({
    where: { id },
    data: {
      ...(payload.title !== undefined && { title: payload.title }),
      ...(payload.description !== undefined && {
        description: payload.description,
      }),
      ...(payload.photoUrl !== undefined && { photoUrl: payload.photoUrl }),
      ...(payload.eventLinks !== undefined && {
        eventLinks: payload.eventLinks,
      }),
      ...(payload.driveLink !== undefined && { driveLink: payload.driveLink }),
      ...(payload.eventType !== undefined && { eventType: payload.eventType }),
      ...(payload.location !== undefined && { location: payload.location }),
      ...(payload.eventDate !== undefined && {
        eventDate: payload.eventDate ? new Date(payload.eventDate) : null,
      }),
      ...(payload.isFeatured !== undefined && {
        isFeatured: payload.isFeatured,
      }),
    },
    include: { createdBy: true },
  });

  return event;
};

const toggleFeatured = async (id: number): Promise<Event> => {
  const existing = await prisma.event.findUnique({ where: { id } });

  if (!existing) {
    throw new ApiError(httpStatus.NOT_FOUND, "Event not found");
  }

  return prisma.event.update({
    where: { id },
    data: { isFeatured: !existing.isFeatured },
  });
};

const deleteEvent = async (id: number): Promise<Event> => {
  const existing = await prisma.event.findUnique({ where: { id } });

  if (!existing) {
    throw new ApiError(httpStatus.NOT_FOUND, "Event not found");
  }

  return prisma.event.delete({ where: { id } });
};

export const eventService = {
  createEvent,
  getAllEvents,
  getEventById,
  getFeaturedEvents,
  updateEvent,
  toggleFeatured,
  deleteEvent,
};