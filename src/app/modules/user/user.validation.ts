import { prisma } from '../../shared/prisma';
import ApiError from '../../errors/api.error';
import httpStatus from 'http-status';

// ─── HELPERS ───────────────────────────────────────────

const isEmpty = (value?: string) => !value || value.trim().length === 0;

const trimValue = (value: string) => value.trim();

// ─── REQUIRED FIELD ───────────────────────────────────────────

const validateRequiredField = (value: any, fieldName: string): string => {
  if (isEmpty(value)) {
    throw new ApiError(httpStatus.BAD_REQUEST, `${fieldName} is required`);
  }

  const trimmed = trimValue(value);

  if (trimmed.length > 255) {
    throw new ApiError(httpStatus.BAD_REQUEST, `${fieldName} must not exceed 255 characters`);
  }

  return trimmed;
};

// ─── EMAIL ───────────────────────────────────────────

const validateEmailUniqueness = async (email: string): Promise<string> => {
  if (isEmpty(email)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Email is required');
  }

  const normalized = trimValue(email).toLowerCase();

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(normalized)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid email format');
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: normalized },
  });

  if (existingUser) {
    throw new ApiError(httpStatus.CONFLICT, 'Email already exists');
  }

  return normalized;
};

// ─── PASSWORD ───────────────────────────────────────────

const validatePassword = (password: string): void => {
  if (!password) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Password is required');
  }

  if (password.length < 6) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Password must be at least 6 characters');
  }

  if (password.length > 128) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Password must not exceed 128 characters');
  }
};

// ─── DATE ───────────────────────────────────────────

const validateDate = (dateString: string, field = 'Date'): Date => {
  if (isEmpty(dateString)) {
    throw new ApiError(httpStatus.BAD_REQUEST, `${field} is required`);
  }

  const date = new Date(dateString);

  if (isNaN(date.getTime())) {
    throw new ApiError(httpStatus.BAD_REQUEST, `${field} must be a valid date`);
  }

  if (date > new Date()) {
    throw new ApiError(httpStatus.BAD_REQUEST, `${field} cannot be in the future`);
  }

  return date;
};

// ─── NAME ───────────────────────────────────────────

const validateName = (name: string, fieldName: string): string => {
  const val = validateRequiredField(name, fieldName);

  if (val.length < 2 || val.length > 100) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `${fieldName} must be between 2 and 100 characters`
    );
  }

  return val;
};

// ─── MOBILE ───────────────────────────────────────────

const validateBangladeshMobile = (mobile: string, fieldName = 'Mobile'): string => {
  const val = validateRequiredField(mobile, fieldName);

  const regex = /^(?:\+8801|01)[3-9]\d{8}$/;
  if (!regex.test(val)) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `${fieldName} must be a valid Bangladeshi number`
    );
  }

  return val;
};

// ✅ OPTIONAL MOBILE
const validateOptionalBangladeshMobile = (
  mobile?: string,
  fieldName = 'Mobile'
): string | undefined => {
  if (isEmpty(mobile)) return undefined;

  const trimmed = trimValue(mobile!);

  const regex = /^(?:\+8801|01)[3-9]\d{8}$/;
  if (!regex.test(trimmed)) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `${fieldName} must be a valid Bangladeshi number`
    );
  }

  return trimmed;
};

// ─── PHONE ───────────────────────────────────────────

const validatePhoneNumber = (phone: string, fieldName = 'Phone'): string => {
  const val = validateRequiredField(phone, fieldName);

  const regex = /^[\d\s\-\+\(\)]{10,20}$/;
  if (!regex.test(val)) {
    throw new ApiError(httpStatus.BAD_REQUEST, `${fieldName} format is invalid`);
  }

  return val;
};

// ─── OPTIONAL FIELDS ───────────────────────────────────────────

const validateBirthnumber = (birth?: string): string | undefined => {
  if (isEmpty(birth)) return undefined;

  const val = trimValue(birth!);

  if (val.length < 4 || val.length > 30) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Birth number must be between 4 and 30 characters'
    );
  }

  return val;
};

const validateNID = (nid?: string): string | undefined => {
  if (isEmpty(nid)) return undefined;

  const val = trimValue(nid!);

  if (val.length < 10 || val.length > 20) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'NID must be between 10 and 20 characters'
    );
  }

  return val;
};

// ─── ADDRESS ───────────────────────────────────────────

const validateAddress = (address: string, fieldName: string): string => {
  const val = validateRequiredField(address, fieldName);

  if (val.length < 5 || val.length > 255) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `${fieldName} must be between 5 and 255 characters`
    );
  }

  return val;
};

// ─── SESSION ───────────────────────────────────────────

const validateSession = (session: string): string => {
  const val = validateRequiredField(session, 'Session');

  const regex = /^\d{4}-\d{4}$/;
  if (!regex.test(val)) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Session must be in format YYYY-YYYY (e.g., 2023-2024)'
    );
  }

  return val;
};

// ─── ROLL & REGISTRATION ───────────────────────────────────────────

const validateRoll = (roll: string): string => {
  const val = validateRequiredField(roll, 'Roll');

  if (val.length > 20) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Roll too long');
  }

  return val;
};

const validateRegistration = (registration: string): string => {
  const val = validateRequiredField(registration, 'Registration');

  if (val.length > 30) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Registration too long');
  }

  return val;
};

// ─── GENDER ───────────────────────────────────────────

const validateGender = (gender: string): string => {
  const val = validateRequiredField(gender, 'Gender');

  const valid = ['Male', 'Female', 'Other'];
  if (!valid.includes(val)) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Gender must be Male, Female, or Other'
    );
  }

  return val;
};

// ─── ROLE ───────────────────────────────────────────

const validateRoleLabel = (roleLabel: string): string => {
  const val = validateRequiredField(roleLabel, 'Role Label');

  const valid = ['Super Admin', 'Sub Admin'];
  if (!valid.includes(val)) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Role must be Super Admin or Sub Admin'
    );
  }

  return val;
};

// ─── DESIGNATION ───────────────────────────────────────────

const validateDesignation = (designation: string): string => {
  const val = validateRequiredField(designation, 'Designation');

  if (val.length < 2 || val.length > 100) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Designation must be between 2 and 100 characters'
    );
  }

  return val;
};

// ─── DB VALIDATIONS ───────────────────────────────────────────

const validateGroupExists = async (groupId: number) => {
  if (!groupId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Group ID is required');
  }

  const group = await prisma.group.findUnique({ where: { id: groupId } });

  if (!group || group.isDeleted) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Group not found');
  }
};

const validateDepartmentExists = async (departmentId: number) => {
  if (!departmentId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Department ID is required');
  }

  const dept = await prisma.department.findUnique({
    where: { id: departmentId },
  });

  if (!dept || dept.isDeleted) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Department not found');
  }
};

// ─── UNIQUE CHECK ───────────────────────────────────────────

const validateStudentRollRegistration = async (
  roll: string,
  registration: string,
  excludeUserId?: number
) => {
  const where: any = {
    OR: [{ roll }, { registration }],
  };

  if (excludeUserId) {
    where.NOT = { userId: excludeUserId };
  }

  const existing = await prisma.student.findFirst({ where });

  if (existing) {
    if (existing.roll === roll) {
      throw new ApiError(httpStatus.CONFLICT, 'Roll already exists');
    }
    throw new ApiError(httpStatus.CONFLICT, 'Registration already exists');
  }
};

// ─── MAIN VALIDATORS ───────────────────────────────────────────
export const validateTeacherData = async (data: any): Promise<void> => {
  validateName(data.name, 'Teacher name');
  await validateEmailUniqueness(data.email);
  validateBangladeshMobile(data.mobile, 'Mobile number');
  validateDesignation(data.designation);
  await validateDepartmentExists(data.departmentId);
};

export const validateStudentData = async (data: any, excludeUserId?: number) => {
  validateName(data.name, 'Student name');
  await validateEmailUniqueness(data.email);

  validateRoll(data.roll);
  validateRegistration(data.registration);
  validateBangladeshMobile(data.mobile);

  validateGender(data.gender);
  validateDate(data.birthDate, 'Birth date');

  validateBirthnumber(data.birthnumber); // optional
  validateNID(data.nid); // optional

  validateName(data.fatherName, 'Father name');
  validateName(data.motherName, 'Mother name');

  validateOptionalBangladeshMobile(data.fatherMobile, 'Father mobile');
  validateOptionalBangladeshMobile(data.motherMobile, 'Mother mobile');

  validateAddress(data.presentAddress, 'Present address');
  validateAddress(data.permanentAddress, 'Permanent address');

  await validateStudentRollRegistration(
    data.roll,
    data.registration,
    excludeUserId
  );

  await validateGroupExists(data.groupId);
  await validateDepartmentExists(data.departmentId);
};

export const validateAdminData = async (data: any): Promise<void> => {
  await validateEmailUniqueness(data.email);
  validateRoleLabel(data.roleLabel);
};



// In validationService

export const validateTeacherUpdateData = (data: any): void => {
  if (data.name) validateName(data.name, 'Teacher name');
  if (data.mobile) validateBangladeshMobile(data.mobile, 'Mobile number');
  if (data.designation) validateDesignation(data.designation);
  if (data.departmentId) validateDepartmentExists(data.departmentId); // Note: make this sync or handle async separately
};

export const validateStudentUpdateData = (data: any): void => {
  if (data.name) validateName(data.name, 'Student name');
  if (data.mobile) validateBangladeshMobile(data.mobile);
  if (data.gender) validateGender(data.gender);
  if (data.birthDate) validateDate(data.birthDate, 'Birth date');
  if (data.fatherName) validateName(data.fatherName, 'Father name');
  if (data.motherName) validateName(data.motherName, 'Mother name');
  if (data.presentAddress) validateAddress(data.presentAddress, 'Present address');
  if (data.permanentAddress) validateAddress(data.permanentAddress, 'Permanent address');

  // Explicitly block sensitive fields
  if (data.email) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Email cannot be updated");
  }
  if (data.roll) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Roll cannot be updated");
  }
  if (data.registration) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Registration cannot be updated");
  }
};

// ─── EXPORT ───────────────────────────────────────────

export const validationService = {
  validateAdminData,
  validateTeacherData,
  validateStudentData,
  validateEmailUniqueness,
  validatePassword,
  validateDate,
  validateGroupExists,
  validateDepartmentExists,
  validateStudentRollRegistration,
  validateRequiredField,
  validatePhoneNumber,
  validateBangladeshMobile,
  validateOptionalBangladeshMobile,
  validateGender,
  validateBirthnumber,
  validateNID,
  validateAddress,
  validateSession,
  validateRoll,
  validateRegistration,
  validateName,
  validateRoleLabel,
  validateDesignation,
};