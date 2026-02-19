import { prisma } from "../../shared/prisma";
import { fileUploader } from "../../helper/fileUploader";
import bcrypt from "bcryptjs";
import { Request } from "express";

export const userService = {

  createStudent: async (req: Request) => {
    const {
      name,
      email,
      password,
      roll,
      registration,
      mobile,
      gender,
      birthDate,
      birthnumber,
      nid,
      fatherName,
      motherName,
      fatherMobile,
      motherMobile,
      presentAddress,
      permanentAddress,
      session,
      groupId,
      departmentId,
    } = req.body;

    if (!name || !email || !password) throw new Error("Name, email, and password are required");

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existingUser) throw new Error("User with this email already exists");

    const hashedPassword = await bcrypt.hash(password, 10);

    let profilePhoto: string | null = null;
    if (req.file) {
      const uploadResult = await fileUploader.uploadToCloudinary(req.file);
      profilePhoto = uploadResult?.secure_url || null;
    }

    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        password: hashedPassword,
        needPassChange: true,
        student: {
          create: {
            name,
            email: normalizedEmail,
            roll,
            registration,
            mobile,
            gender,
            birthDate: new Date(birthDate),
            birthnumber,
            nid,
            fatherName,
            motherName,
            fatherMobile,
            motherMobile,
            presentAddress,
            permanentAddress,
            session,
            profilePhoto,
            groupId: Number(groupId),
            departmentId: Number(departmentId),
          },
        },
      },
      include: { student: true },
    });

    return user;
  },

  createTeacher: async (req: Request) => {
    const {
      name,
      email,
      password,
      mobile,
      gender,
      birthDate,
      birthnumber,
      nid,
      presentAddress,
      permanentAddress,
      bio,
      expertise,
    } = req.body;

    if (!name || !email || !password) throw new Error("Name, email, and password are required");

    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existingUser) throw new Error("User with this email already exists");

    const hashedPassword = await bcrypt.hash(password, 10);

    let profilePhoto: string | null = null;
    if (req.file) {
      const uploadResult = await fileUploader.uploadToCloudinary(req.file);
      profilePhoto = uploadResult?.secure_url || null;
    }

    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        password: hashedPassword,
        needPassChange: true,
        teacher: {
          create: {
            name,
            email: normalizedEmail,
            mobile,
            gender,
            birthDate: new Date(birthDate),
            birthnumber,
            nid,
            presentAddress,
            permanentAddress,
            bio,
            expertise,
            profilePhoto,
          },
        },
      },
      include: { teacher: true },
    });

    return user;
  },


  updateProfile: async (req: Request) => {
    const userId = req.params.id;
    const { email, password, ...otherFields } = req.body;

    let profilePhoto: string | null = req.body.profilePhoto || null;
    if (req.file) {
      const uploadResult = await fileUploader.uploadToCloudinary(req.file);
      profilePhoto = uploadResult?.secure_url || profilePhoto;
    }

    const hashedPassword = password ? await bcrypt.hash(password, 10) : undefined;

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        email: email?.toLowerCase(),
        password: hashedPassword,
        student: otherFields.student ? { update: { ...otherFields.student, profilePhoto } } : undefined,
        teacher: otherFields.teacher ? { update: { ...otherFields.teacher, profilePhoto } } : undefined,
      },
      include: { student: true, teacher: true },
    });

    return updatedUser;
  },
};
