import { prisma } from '../../shared/prisma';
import { Request } from 'express';
import * as bcrypt from 'bcryptjs';
import config from '../../../config';
import { fileUploader } from '../../helper/fileUploader';
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
  isDeleted: true,
  needPasswordChange: true,
  createdAt: true,
  updatedAt: true,
  admin: true,
  teacher: true,
  student: true,
} satisfies Prisma.UserSelect;


const uploadProfilePhoto = async (req: Request, existingUrl?: string): Promise<string | null> => {
  if (!req.file) return existingUrl ?? null;

  const uploaded = await fileUploader.uploadToCloudinary(req.file);
  if (!uploaded?.secure_url) {
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to upload profile photo');
  }
  return uploaded.secure_url;
};

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
          needPasswordChange: false,
          admin: {
            create: {
              roleLabel,
            },
          },
        },
        select: safeUserSelect,
      });

      return { user };
    });
  },


  createTeacher: async (req: Request) => {
    const teacherData = req.body.teacher;
    const { password } = req.body;

    validationService.validatePassword(password);
    await validationService.validateTeacherData(teacherData);

    const profilePhotoUrl = await uploadProfilePhoto(req, teacherData.profilePhoto);

    return prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: teacherData.email.toLowerCase(),
          password: await hashPassword(password),
          role: Role.TEACHER,
          needPasswordChange: true,
          teacher: {
            create: {
              departmentId: teacherData.departmentId,
              name: teacherData.name,
              email: teacherData.email.toLowerCase(),
              mobile: teacherData.mobile,
              designation: teacherData.designation,
              profilePhoto: profilePhotoUrl,
            },
          },
        },
        select: safeUserSelect,
      });

      return { user };
    });
  },


  createStudent: async (req: Request) => {
    const studentData = req.body.student;
    const { password } = req.body;

    validationService.validatePassword(password);
    await validationService.validateStudentData(studentData);

    const profilePhotoUrl = await uploadProfilePhoto(req, studentData.profilePhoto);

    return prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: studentData.email.toLowerCase(),
          password: await hashPassword(password),
          role: Role.STUDENT,
          needPasswordChange: true,
          student: {
            create: {
              group: {
                connect: { id: studentData.groupId },
              },
              department: {
                connect: { id: studentData.departmentId },
              },
              name: studentData.name,
              email: studentData.email.toLowerCase(),
              roll: studentData.roll,
              registration: studentData.registration,
              mobile: studentData.mobile,
              gender: studentData.gender,
              birthDate: validationService.validateDate(studentData.birthDate),
              birthnumber: studentData.birthnumber ?? "",
              nid: studentData.nid ?? null,
              fatherName: studentData.fatherName,
              motherName: studentData.motherName,
              fatherMobile: studentData.fatherMobile ?? "null",
              motherMobile: studentData.motherMobile ?? "null",
              presentAddress: studentData.presentAddress,
              permanentAddress: studentData.permanentAddress,
              profilePhoto: profilePhotoUrl,
            },
          },
        },
        select: safeUserSelect,
      });

      return { user };
    });
  },
  updateProfile: async (req: Request) => {
    const userId = req.user?.id;
    const role = req.user?.role as Role;

    if (!userId || !role) {
      throw new ApiError(httpStatus.UNAUTHORIZED, "User not authenticated");
    }

    // Upload MUST complete fully before any DB work begins
    let profilePhotoUrl: string | null = null;
    try {
      profilePhotoUrl = await uploadProfilePhoto(req);
    } catch (error) {
      throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, "Failed to upload profile photo");
    }

    return prisma.$transaction(
      async (tx) => {
        if (role === Role.TEACHER) {
          const teacherData = req.body.teacher || req.body;

          if (teacherData.email) {
            throw new ApiError(httpStatus.BAD_REQUEST, "Email cannot be updated");
          }

          const updatedUser = await tx.user.update({
            where: { id: Number(userId) },
            data: {
              teacher: {
                update: {
                  name: teacherData.name,
                  mobile: teacherData.mobile,
                  designation: teacherData.designation,
                  departmentId: teacherData.departmentId,
                  ...(profilePhotoUrl && { profilePhoto: profilePhotoUrl }),
                },
              },
            },
            select: safeUserSelect,
          });

          return { user: updatedUser };

        } else if (role === Role.STUDENT) {
          const studentData = req.body.student || req.body;

          if (studentData.email) {
            throw new ApiError(httpStatus.BAD_REQUEST, "Email cannot be updated");
          }
          if (studentData.roll) {
            throw new ApiError(httpStatus.BAD_REQUEST, "Roll cannot be updated");
          }
          if (studentData.registration) {
            throw new ApiError(httpStatus.BAD_REQUEST, "Registration cannot be updated");
          }

          const updatedUser = await tx.user.update({
            where: { id: Number(userId) },
            data: {
              student: {
                update: {
                  name: studentData.name,
                  mobile: studentData.mobile,
                  gender: studentData.gender,
                  birthDate: studentData.birthDate
                    ? validationService.validateDate(studentData.birthDate)
                    : undefined,
                  birthnumber: studentData.birthnumber,
                  nid: studentData.nid,
                  fatherName: studentData.fatherName,
                  motherName: studentData.motherName,
                  fatherMobile: studentData.fatherMobile,
                  motherMobile: studentData.motherMobile,
                  presentAddress: studentData.presentAddress,
                  permanentAddress: studentData.permanentAddress,
                  ...(profilePhotoUrl && { profilePhoto: profilePhotoUrl }),
                },
              },
            },
            select: safeUserSelect,
          });

          return { user: updatedUser };

        } else {
          throw new ApiError(
            httpStatus.FORBIDDEN,
            "Only students and teachers can update their profile"
          );
        }
      },
      {
        timeout: 10000, // 10 second timeout
      }
    );
  },
};
