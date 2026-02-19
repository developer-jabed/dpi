import { prisma } from "../../shared/prisma";
import { Request } from "express";
import * as bcrypt from 'bcryptjs';
import config from "../../../config";
import { fileUploader } from "../../helper/fileUploader";
import { IPaginationOptions } from "../../interfaces/pagination";
import { paginationHelper } from "../../helper/paginationHelper";
import { userSearchAbleFields } from "./user.constant";
import { Role, UserStatus, Prisma } from "@prisma/client";

export const userService = {

  createAdmin: async (req: Request) => {
    const file = req.file;
    if (file) {
      const uploaded = await fileUploader.uploadToCloudinary(file);
      req.body.admin.profilePhoto = uploaded?.secure_url;
    }

    const hashedPassword = await bcrypt.hash(req.body.password, Number(config.salt_round));

    const userData = {
      email: req.body.admin.email.toLowerCase(),
      password: hashedPassword,
      role: Role.ADMIN,
    };

    return await prisma.$transaction(async tx => {
      await tx.user.create({ data: userData });
      return tx.admin.create({ data: req.body.admin });
    });
  },


  createCR: async (req: Request) => {
    const file = req.file;
    if (file) {
      const uploaded = await fileUploader.uploadToCloudinary(file);
      req.body.cr.profilePhoto = uploaded?.secure_url;
    }

    const hashedPassword = await bcrypt.hash(req.body.password, Number(config.salt_round));
    const userData = { email: req.body.cr.email.toLowerCase(), password: hashedPassword, role: Role.CR };

    return await prisma.$transaction(async tx => {
      await tx.user.create({ data: userData });
      return tx.cr.create({ data: req.body.cr });
    });
  },

  // ========== CREATE TEACHER ==========
  createTeacher: async (req: Request) => {
    const file = req.file;
    if (file) {
      const uploaded = await fileUploader.uploadToCloudinary(file);
      req.body.teacher.profilePhoto = uploaded?.secure_url;
    }

    const hashedPassword = await bcrypt.hash(req.body.password, Number(config.salt_round));
    const userData = { email: req.body.teacher.email.toLowerCase(), password: hashedPassword, role: Role.TEACHER };

    return await prisma.$transaction(async tx => {
      await tx.user.create({ data: userData });
      return tx.teacher.create({ data: req.body.teacher });
    });
  },

  // ========== CREATE STUDENT ==========
  createStudent: async (req: Request) => {
    const file = req.file;
    if (file) {
      const uploaded = await fileUploader.uploadToCloudinary(file);
      req.body.student.profilePhoto = uploaded?.secure_url;
    }

    const hashedPassword = await bcrypt.hash(req.body.password, Number(config.salt_round));
    const userData = { email: req.body.student.email.toLowerCase(), password: hashedPassword, role: Role.STUDENT };

    return await prisma.$transaction(async tx => {
      await tx.user.create({ data: userData });
      return tx.student.create({ data: req.body.student });
    });
  },

  // ========== GET ALL USERS ==========
  getAllFromDB: async (params: any, options: IPaginationOptions) => {
    const { page, limit, skip } = paginationHelper.calculatePagination(options);
    const { searchTerm, ...filterData } = params;

    const andConditions: Prisma.userWhereInput[] = [];
    if (searchTerm) {
      andConditions.push({
        OR: userSearchAbleFields.map(field => ({ [field]: { contains: searchTerm, mode: 'insensitive' } }))
      });
    }
    if (Object.keys(filterData).length > 0) {
      andConditions.push({
        AND: Object.keys(filterData).map(key => ({ [key]: { equals: filterData[key] } }))
      });
    }
    const whereConditions: Prisma.userWhereInput = andConditions.length ? { AND: andConditions } : {};

    const data = await prisma.user.findMany({
      where: whereConditions,
      skip,
      take: limit,
      orderBy: options.sortBy && options.sortOrder ? { [options.sortBy]: options.sortOrder } : { createdAt: 'desc' },
      include: { admin: true, cr: true, teacher: true, student: true },
    });

    const total = await prisma.user.count({ where: whereConditions });
    return { meta: { page, limit, total }, data };
  },

  // ========== UPDATE PROFILE ==========
  updateProfile: async (userId: string, req: Request) => {
    const file = req.file;
    if (file) req.body.profilePhoto = (await fileUploader.uploadToCloudinary(file))?.secure_url;
    const hashedPassword = req.body.password ? await bcrypt.hash(req.body.password, Number(config.salt_round)) : undefined;

    return prisma.user.update({
      where: { id: userId },
      data: {
        email: req.body.email?.toLowerCase(),
        password: hashedPassword,
        admin: req.body.admin ? { update: req.body.admin } : undefined,
        cr: req.body.cr ? { update: req.body.cr } : undefined,
        teacher: req.body.teacher ? { update: req.body.teacher } : undefined,
        student: req.body.student ? { update: req.body.student } : undefined,
      },
      include: { admin: true, cr: true, teacher: true, student: true },
    });
  },
};
