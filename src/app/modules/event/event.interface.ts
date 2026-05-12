import { EventType } from "@prisma/client";

export interface IEventFilterRequest {
  search?: string;
  eventType?: EventType;
  isFeatured?: boolean | string;
  location?: string;
  fromDate?: string;
  toDate?: string;
}

export interface ICreateEvent {
  title: string;
  description: string;
  photoUrl?: string;
  eventLinks?: string[];
  driveLink?: string;
  eventType?: EventType;
  location?: string;
  eventDate?: string | Date;
  isFeatured?: boolean;
  createdById?: number;
}

export interface IUpdateEvent {
  title?: string;
  description?: string;
  photoUrl?: string;
  eventLinks?: string[];
  driveLink?: string;
  eventType?: EventType;
  location?: string;
  eventDate?: string | Date;
  isFeatured?: boolean;
}