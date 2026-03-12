import { prisma } from '../../shared/prisma';
import { Request } from 'express';
import * as bcrypt from 'bcryptjs';
import config from '../../../config';
import { fileUploader } from '../../helper/fileUploader';
import { IPaginationOptions } from '../../interfaces/pagination';
import { paginationHelper } from '../../helper/paginationHelper';
import { userSearchAbleFields } from './user.constant';
import { Role, Prisma } from '@prisma/client';
import ApiError from '../../errors/api.error';
import httpStatus from 'http-status';
import { validationService } from './user.validation';

const hashPassword = (password: string) =>
  bcrypt.hash(password, Number(config.salt_round));

const safeUserSelect = {
  id: true,
  email: true,
  role: true,
  status: true,
  needPassChange: true,
  lastLogin: true,
  createdAt: true,
  updatedAt: true,
  admin: true,
  cr: true,
  teacher: true,
  student: true,
} satisfies Prisma.userSelect;

export const userService = {
  // ========================= CREATE ADMIN =========================
  createAdmin: async (req: Request) => {
    const { email, roleLabel } = req.body.admin;
    const { password } = req.body;

    validationService.validatePassword(password);
    await validationService.validateAdminData({ email, roleLabel });

    return prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: email.toLowerCase(),
          password: await hashPassword(password),
          role: Role.ADMIN,
        },
      });

      const admin = await tx.admin.create({
        data: {
          userId: user.id,
          roleLabel,
        },
      });

      return {
        user: { ...user, password: undefined },
        admin,
      };
    });
  },

  // ========================= CREATE CR =========================
  createCR: async (req: Request) => {
    const { email, groupId, studentData } = req.body.cr;
    const { password } = req.body;

    // Validate password and CR data
    validationService.validatePassword(password);
    await validationService.validateCRData({ email, groupId, studentData });

    // Upload profile photo if provided
    let profilePhotoUrl = studentData?.profilePhoto;
    if (req.file) {
      const uploaded = await fileUploader.uploadToCloudinary(req.file);
      if (!uploaded?.secure_url) {
        throw new ApiError(
          httpStatus.INTERNAL_SERVER_ERROR,
          'Failed to upload profile photo'
        );
      }
      profilePhotoUrl = uploaded.secure_url;
    }

    // Transaction to create CR, optional student
    return prisma.$transaction(async (tx) => {
      // 1️⃣ Create CR user
      const crUser = await tx.user.create({
        data: {
          email: email.toLowerCase(),
          password: await hashPassword(password),
          role: Role.CR,
        },
      });

      // 2️⃣ Create optional student
      let student = null;
      if (studentData) {
        const studentUser = await tx.user.create({
          data: {
            email: studentData.email.toLowerCase(),
            password: await hashPassword(password),
            role: Role.STUDENT,
          },
        });

        student = await tx.student.create({
          data: {
            userId: studentUser.id,
            name: studentData.name,
            email: studentData.email.toLowerCase(),
            roll: studentData.roll,
            registration: studentData.registration,
            mobile: studentData.mobile,
            gender: studentData.gender,
            birthDate: validationService.validateDate(studentData.birthDate),
            birthnumber: studentData.birthnumber,
            fatherName: studentData.fatherName,
            motherName: studentData.motherName,
            fatherMobile: studentData.fatherMobile,
            motherMobile: studentData.motherMobile,
            presentAddress: studentData.presentAddress,
            permanentAddress: studentData.permanentAddress,
            session: studentData.session,
            groupId: studentData.groupId || groupId,
            departmentId: studentData.departmentId,
            profilePhoto: profilePhotoUrl,
            isDeleted: false,
          },
        });
      }

      // 3️⃣ Create CR relation
      const crData: any = { userId: crUser.id, groupId };
      if (student) crData.studentId = student.id;

      const cr = await tx.cr.create({ data: crData });


      return {
        user: { id: crUser.id, email: crUser.email },
        cr,
        student,
      };
    });
  },


  // ========================= CREATE TEACHER =========================
  createTeacher: async (req: Request) => {
    const teacherData = req.body.teacher;
    const { password } = req.body;

    validationService.validatePassword(password);
    await validationService.validateTeacherData(teacherData);

    let profilePhotoUrl = teacherData.profilePhoto;
    if (req.file) {
      const uploaded = await fileUploader.uploadToCloudinary(req.file);
      if (!uploaded?.secure_url) {
        throw new ApiError(
          httpStatus.INTERNAL_SERVER_ERROR,
          'Failed to upload profile photo'
        );
      }
      profilePhotoUrl = uploaded.secure_url;
    }

    return prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: teacherData.email.toLowerCase(),
          password: await hashPassword(password),
          role: Role.TEACHER,
        },
      });

      const teacher = await tx.teacher.create({
        data: {
          userId: user.id,
          name: teacherData.name,
          email: teacherData.email.toLowerCase(),
          mobile: teacherData.mobile,
          gender: teacherData.gender,
          birthDate: validationService.validateDate(teacherData.birthDate),
          birthnumber: teacherData.birthnumber,
          nid: teacherData.nid,
          presentAddress: teacherData.presentAddress,
          permanentAddress: teacherData.permanentAddress,
          bio: teacherData.bio,
          expertise: teacherData.expertise,
          profilePhoto: profilePhotoUrl,
        },
      });

      return {
        user: { ...user, password: undefined },
        teacher,
      };
    });
  },


  createStudent: async (req: Request) => {
    const studentData = req.body.student;
    const password = req.body.password;

    console.log(studentData, password);
    validationService.validatePassword(password);
    await validationService.validateStudentData(studentData);

    let profilePhotoUrl = studentData.profilePhoto;
    if (req.file) {
      const uploaded = await fileUploader.uploadToCloudinary(req.file);
      if (!uploaded?.secure_url) {
        throw new ApiError(
          httpStatus.INTERNAL_SERVER_ERROR,
          'Failed to upload profile photo'
        );
      }
      profilePhotoUrl = uploaded.secure_url;
    }

    return prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: studentData.email.toLowerCase(),
          password: await hashPassword(password),
          role: Role.STUDENT,
        },
      });

      const student = await tx.student.create({
        data: {
          userId: user.id,
          name: studentData.name,
          email: studentData.email.toLowerCase(),
          roll: studentData.roll,
          registration: studentData.registration,
          mobile: studentData.mobile,
          gender: studentData.gender,
          birthDate: validationService.validateDate(studentData.birthDate),
          birthnumber: studentData.birthnumber,
          nid: studentData.nid,
          fatherName: studentData.fatherName,
          motherName: studentData.motherName,
          fatherMobile: studentData.fatherMobile,
          motherMobile: studentData.motherMobile,
          presentAddress: studentData.presentAddress,
          permanentAddress: studentData.permanentAddress,
          session: studentData.session,
          groupId: studentData.groupId,
          departmentId: studentData.departmentId,
          profilePhoto: profilePhotoUrl,
          isDeleted: false,
        },
      });

      return {
        user: { ...user, password: undefined },
        student,
      };
    });
  },
};