import { prisma } from '../../shared/prisma';
import ApiError from '../../errors/api.error';
import httpStatus from 'http-status';

const validateEmailUniqueness = async (email: string): Promise<string> => {
  if (!email || email.trim().length === 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Email is required');
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid email format');
  }

  const emailLowercase = email.toLowerCase();
  const existingUser = await prisma.user.findUnique({
    where: { email: emailLowercase },
  });

  if (existingUser) {
    throw new ApiError(httpStatus.CONFLICT, 'Email already exists');
  }

  return emailLowercase;
};

const validatePassword = (password: string): void => {
  if (!password) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Password is required');
  }

  if (password.length < 6) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Password must be at least 6 characters long');
  }

  if (password.length > 128) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Password must not exceed 128 characters');
  }

  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);

  if (!hasUpperCase || !hasLowerCase || !hasNumbers) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Password must contain uppercase, lowercase, and numeric characters'
    );
  }
};

const validateDate = (dateString: string, fieldName: string = 'Date'): Date => {
  if (!dateString) {
    throw new ApiError(httpStatus.BAD_REQUEST, `${fieldName} is required`);
  }

  const date = new Date(dateString);
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    throw new ApiError(httpStatus.BAD_REQUEST, `${fieldName} must be a valid date`);
  }

  if (date > new Date()) {
    throw new ApiError(httpStatus.BAD_REQUEST, `${fieldName} cannot be in the future`);
  }

  return date;
};

const validateGroupExists = async (groupId: number): Promise<void> => {
  if (!groupId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Group ID is required');
  }

  const group = await prisma.group.findUnique({
    where: { id: groupId },
  });

  // if (group.)

  if (!group) {
    throw new ApiError(httpStatus.NOT_FOUND, `Group with id ${groupId} does not exist`);
  }
};

const validateDepartmentExists = async (departmentId: number): Promise<void> => {
  if (!departmentId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Department ID is required');
  }

  const department = await prisma.department.findUnique({
    where: { id: departmentId },
  });

  if (!department) {
    throw new ApiError(httpStatus.NOT_FOUND, `Department with id ${departmentId} does not exist`);
  }
};

const validateStudentRollRegistration = async (
  roll: string,
  registration: string,
  excludeUserId?: string
): Promise<void> => {
  if (!roll || roll.trim().length === 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Roll number is required');
  }

  if (!registration || registration.trim().length === 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Registration number is required');
  }

  const whereCondition: any = {
    OR: [{ roll }, { registration }],
  };

  if (excludeUserId) {
    whereCondition.NOT = { userId: excludeUserId };
  }

  const existingStudent = await prisma.student.findFirst({
    where: whereCondition,
  });

  if (existingStudent) {
    if (existingStudent.roll === roll) {
      throw new ApiError(httpStatus.CONFLICT, 'Roll number already exists');
    }
    throw new ApiError(httpStatus.CONFLICT, 'Registration number already exists');
  }
};

const validateRequiredField = (value: any, fieldName: string): string => {
  if (!value || (typeof value === 'string' && value.trim().length === 0)) {
    throw new ApiError(httpStatus.BAD_REQUEST, `${fieldName} is required`);
  }

  if (typeof value === 'string' && value.trim().length > 255) {
    throw new ApiError(httpStatus.BAD_REQUEST, `${fieldName} must not exceed 255 characters`);
  }

  return typeof value === 'string' ? value.trim() : value;
};

const validatePhoneNumber = (phone: string, fieldName: string = 'Phone'): string => {
  const validatedPhone = validateRequiredField(phone, fieldName);

  const phoneRegex = /^[\d\s\-\+\(\)]{10,20}$/;
  if (!phoneRegex.test(validatedPhone)) {
    throw new ApiError(httpStatus.BAD_REQUEST, `${fieldName} format is invalid`);
  }

  return validatedPhone;
};

const validateBangladeshMobile = (mobile: string, fieldName: string = 'Mobile'): string => {
  const validatedMobile = validateRequiredField(mobile, fieldName);

  const bangladeshMobileRegex = /^(?:\+8801|01)[3-9]\d{8}$/;
  if (!bangladeshMobileRegex.test(validatedMobile)) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `${fieldName} must be a valid Bangladeshi number (+8801XXXXXXXXX or 01XXXXXXXXX)`
    );
  }

  return validatedMobile;
};

const validateGender = (gender: string): string => {
  const validatedGender = validateRequiredField(gender, 'Gender');

  const validGenders = ['Male', 'Female', 'Other'];
  if (!validGenders.includes(validatedGender)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Gender must be Male, Female, or Other');
  }

  return validatedGender;
};

const validateBirthnumber = (birthnumber: string): string => {
  const validatedBirthNumber = validateRequiredField(birthnumber, 'Birth number');

  if (validatedBirthNumber.length < 4 || validatedBirthNumber.length > 30) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Birth number must be between 4 and 30 characters');
  }

  return validatedBirthNumber;
};

const validateNID = (nid: string | undefined): string | undefined => {
  if (!nid) return undefined;

  const trimmedNID = nid.trim();
  if (trimmedNID.length === 0) return undefined;

  if (trimmedNID.length < 10 || trimmedNID.length > 20) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'NID must be between 10 and 20 characters');
  }

  return trimmedNID;
};

const validateAddress = (address: string, fieldName: string): string => {
  const validatedAddress = validateRequiredField(address, fieldName);

  if (validatedAddress.length < 5 || validatedAddress.length > 255) {
    throw new ApiError(httpStatus.BAD_REQUEST, `${fieldName} must be between 5 and 255 characters`);
  }

  return validatedAddress;
};

const validateSession = (session: string): string => {
  const validatedSession = validateRequiredField(session, 'Session');

  if (validatedSession.length < 4 || validatedSession.length > 20) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Session must be between 4 and 20 characters');
  }

  return validatedSession;
};

const validateRoll = (roll: string): string => {
  const validatedRoll = validateRequiredField(roll, 'Roll');

  if (validatedRoll.length < 1 || validatedRoll.length > 20) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Roll must be between 1 and 20 characters');
  }

  return validatedRoll;
};

const validateRegistration = (registration: string): string => {
  const validatedRegistration = validateRequiredField(registration, 'Registration');

  if (validatedRegistration.length < 1 || validatedRegistration.length > 30) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Registration must be between 1 and 30 characters');
  }

  return validatedRegistration;
};

const validateName = (name: string, fieldName: string): string => {
  const validatedName = validateRequiredField(name, fieldName);

  if (validatedName.length < 2 || validatedName.length > 100) {
    throw new ApiError(httpStatus.BAD_REQUEST, `${fieldName} must be between 2 and 100 characters`);
  }

  return validatedName;
};

const validateRoleLabel = (roleLabel: string): string => {
  const validatedRoleLabel = validateRequiredField(roleLabel, 'Role Label');

  const validRoleLabels = ['Super Admin', 'Sub Admin'];
  if (!validRoleLabels.includes(validatedRoleLabel)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Role Label must be either "Super Admin" or "Sub Admin"');
  }

  return validatedRoleLabel;
};

export const validateAdminData = async (data: any): Promise<void> => {
  await validateEmailUniqueness(data.email);
  validateRoleLabel(data.roleLabel);
};

export const validateTeacherData = async (data: any): Promise<void> => {
  validateName(data.name, 'Teacher name');
  await validateEmailUniqueness(data.email);
  validateBangladeshMobile(data.mobile, 'Mobile number');
  validateGender(data.gender);
  validateDate(data.birthDate, 'Birth date');
  validateBirthnumber(data.birthnumber);
  validateAddress(data.presentAddress, 'Present address');
  validateAddress(data.permanentAddress, 'Permanent address');
  validateNID(data.nid);

  if (data.bio && typeof data.bio === 'string' && data.bio.length > 1000) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Bio must not exceed 1000 characters');
  }

  if (data.expertise && typeof data.expertise === 'string' && data.expertise.length > 255) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Expertise must not exceed 255 characters');
  }
};

export const validateStudentData = async (data: any, excludeUserId?: string): Promise<void> => {
  validateName(data.name, 'Student name');
  await validateEmailUniqueness(data.email);
  validateRoll(data.roll);
  validateRegistration(data.registration);
  validateBangladeshMobile(data.mobile, 'Mobile number');
  validateGender(data.gender);
  validateDate(data.birthDate, 'Birth date');
  validateBirthnumber(data.birthnumber);
  validateName(data.fatherName, 'Father name');
  validateName(data.motherName, 'Mother name');
  validateBangladeshMobile(data.fatherMobile, 'Father mobile');
  validateBangladeshMobile(data.motherMobile, 'Mother mobile');
  validateAddress(data.presentAddress, 'Present address');
  validateAddress(data.permanentAddress, 'Permanent address');
  validateSession(data.session);
  validateNID(data.nid);
  await validateStudentRollRegistration(data.roll, data.registration, excludeUserId);
  await validateGroupExists(data.groupId);
  await validateDepartmentExists(data.departmentId);
};

export const validateCRData = async (data: any): Promise<void> => {
  await validateEmailUniqueness(data.email);
  await validateGroupExists(data.groupId);

  if (data.studentData) {
    await validateStudentData(data.studentData);
  }
};

export const validationService = {
  validateAdminData,
  validateTeacherData,
  validateStudentData,
  validateCRData,
  validateEmailUniqueness,
  validatePassword,
  validateDate,
  validateGroupExists,
  validateDepartmentExists,
  validateStudentRollRegistration,
  validateRequiredField,
  validatePhoneNumber,
  validateBangladeshMobile,
  validateGender,
  validateBirthnumber,
  validateNID,
  validateAddress,
  validateSession,
  validateRoll,
  validateRegistration,
  validateName,
  validateRoleLabel,
};