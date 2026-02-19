import { prisma } from "../../shared/prisma";
import { Request } from "express";
import httpStatus from "http-status";
import ApiError from "../../errors/api.error";
import { IDepartmentFilter } from "./department.interface";
import { paginationHelper } from "../../helper/paginationHelper";
import { departmentSearchableFields } from "./department.constant";
import { Prisma } from "@prisma/client";


const createDepartment = async (req: Request) => {
    console.log(req.body)
  const { name, code } = req.body;

  if (!name || !code) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Name and code are required");
  }


  const existingDepartment = await prisma.department.findFirst({
    where: {
      OR: [{ name }, { code }],
    },
  });

  if (existingDepartment) {
    throw new ApiError(
      httpStatus.CONFLICT,
      "Department with same name or code already exists"
    );
  }

  return await prisma.department.create({
    data: {
      name,
      code,
    },
  });
};

const getAllDepartments = async (
  filters: IDepartmentFilter,
  options: any
) => {
  const { page, limit, skip } = paginationHelper.calculatePagination(options);
  const { searchTerm, ...filterData } = filters;

  const andConditions: Prisma.DepartmentWhereInput[] = [];

  if (searchTerm) {
    andConditions.push({
      OR: departmentSearchableFields.map(field => ({
        [field]: { contains: searchTerm, mode: "insensitive" },
      })),
    });
  }

  if (Object.keys(filterData).length > 0) {
    andConditions.push({
      AND: Object.entries(filterData).map(([key, value]) => ({
        [key]: { equals: value },
      })),
    });
  }

  const whereConditions =
    andConditions.length > 0 ? { AND: andConditions } : {};

  const data = await prisma.department.findMany({
    where: whereConditions,
    skip,
    take: limit,
    orderBy: { id: "desc" },
  });

  const total = await prisma.department.count({ where: whereConditions });

  return {
    meta: { page, limit, total },
    data,
  };
};

const getDepartmentById = async (id: number) => {
  const department = await prisma.department.findUnique({
    where: { id },
  });

  if (!department) {
    throw new ApiError(httpStatus.NOT_FOUND, "Department not found");
  }

  return department;
};

const updateDepartment = async (id: number, req: Request) => {
  const { name, code } = req.body;
  await getDepartmentById(id);

  return prisma.department.update({
    where: { id },
    data: { name, code },
  });
};

const deleteDepartment = async (id: number) => {
  await getDepartmentById(id);

  return prisma.department.delete({
    where: { id },
  });
};

export const departmentService = {
  createDepartment,
  getAllDepartments,
  getDepartmentById,
  updateDepartment,
  deleteDepartment
};
