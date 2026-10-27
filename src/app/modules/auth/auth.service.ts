import * as bcrypt from "bcryptjs";
import httpStatus from "http-status";
import { Secret } from "jsonwebtoken";
import config from "../../../config";
import { prisma } from "../../shared/prisma";
import { jwtHelpers } from "../../helper/jwtHelper";
import ApiError from "../../errors/api.error";
import { redis } from "../../shared/redis";

// ─── Redis Config ─────────────────────────────────────────────────────────────
const USER_CACHE_PREFIX = "user:email:";
const USER_CACHE_TTL = 60 * 30; // 30 minutes

// ─── Redis Helpers ────────────────────────────────────────────────────────────
const getUserFromCache = async (email: string) => {
  try {
    const cached = await redis.get(`${USER_CACHE_PREFIX}${email}`);
    if (!cached) return null;
    return JSON.parse(cached);
  } catch {
    return null;
  }
};

const setUserCache = async (user: {
  id: number;
  email: string;
  role: string;
  needPasswordChange: boolean | null;
}) => {
  try {
    await redis.set(
      `${USER_CACHE_PREFIX}${user.email}`,
      JSON.stringify({
        id: user.id,
        email: user.email,
        role: user.role,
        needPasswordChange: user.needPasswordChange,
      }),
      "EX",
      USER_CACHE_TTL,
    );
  } catch (err) {
    console.error("Redis setUserCache error:", err);
  }
};

const clearUserCache = async (email: string) => {
  try {
    await redis.del(`${USER_CACHE_PREFIX}${email}`);
  } catch (err) {
    console.error("Redis clearUserCache error:", err);
  }
};

// ─── Login ────────────────────────────────────────────────────────────────────
const loginUser = async (payload: { email: string; password: string }) => {
  const user = await prisma.user.findFirst({
    where: {
      email: payload.email,
      isDeleted: false,
    },
    select: {
      id: true,
      email: true,
      password: true,
      role: true,
      needPasswordChange: true,
    },
  });

  if (!user) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "Email not found!");
  }

  const isPasswordCorrect = await bcrypt.compare(
    payload.password,
    user.password,
  );

  if (!isPasswordCorrect) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "Password incorrect!");
  }

  // Cache user (without password)
  await setUserCache({
    id: user.id,
    email: user.email,
    role: user.role,
    needPasswordChange: user.needPasswordChange,
  });

  const tokenPayload = {
    id: user.id,
    email: user.email,
    role: user.role,
  };

  const accessToken = jwtHelpers.generateToken(
    tokenPayload,
    config.jwt.jwt_secret as Secret,
    config.jwt.expires_in as string,
  );

  const refreshToken = jwtHelpers.generateToken(
    tokenPayload,
    config.jwt.refresh_token_secret as Secret,
    config.jwt.refresh_token_expires_in as string,
  );

  return {
    accessToken,
    refreshToken,
    needPasswordChange: user.needPasswordChange,
  };
};

// ─── Refresh Token (Redis accelerated) ────────────────────────────────────────
const refreshToken = async (token: string) => {
  let decoded: any;

  try {
    decoded = jwtHelpers.verifyToken(
      token,
      config.jwt.refresh_token_secret as Secret,
    );
  } catch (err) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "You are not authorized!");
  }

  // 1. Try Redis first
  let user = await getUserFromCache(decoded.email);

  // 2. Fallback to DB
  if (!user) {
    const dbUser = await prisma.user.findFirst({
      where: {
        email: decoded.email,
        isDeleted: false,
      },
      select: {
        id: true,
        email: true,
        role: true,
        needPasswordChange: true,
      },
    });

    if (!dbUser) {
      throw new ApiError(httpStatus.UNAUTHORIZED, "User not found!");
    }

    user = dbUser;
    await setUserCache(user);
  }

  const tokenPayload = {
    id: user.id,
    email: user.email,
    role: user.role,
  };

  const accessToken = jwtHelpers.generateToken(
    tokenPayload,
    config.jwt.jwt_secret as Secret,
    config.jwt.expires_in as string,
  );

  const newRefreshToken = jwtHelpers.generateToken(
    tokenPayload,
    config.jwt.refresh_token_secret as Secret,
    config.jwt.refresh_token_expires_in as string,
  );

  return {
    accessToken,
    refreshToken: newRefreshToken,
    needPasswordChange: user.needPasswordChange,
  };
};

// ─── Change Password ──────────────────────────────────────────────────────────
const changePassword = async (user: any, payload: any) => {
  const userData = await prisma.user.findFirst({
    where: {
      email: user.email,
      isDeleted: false,
    },
    select: {
      id: true,
      email: true,
      password: true,
    },
  });

  if (!userData) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found!");
  }

  const isCorrectPassword = await bcrypt.compare(
    payload.oldPassword,
    userData.password,
  );

  if (!isCorrectPassword) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "Password incorrect!");
  }

  const hashedPassword = await bcrypt.hash(
    payload.newPassword,
    Number(config.salt_round),
  );

  await prisma.user.update({
    where: { email: userData.email },
    data: {
      password: hashedPassword,
      needPasswordChange: false,
    },
  });

  // Clear cache after password change
  await clearUserCache(userData.email);

  return {
    message: "Password changed successfully!",
  };
};

// ─── Reset Password ───────────────────────────────────────────────────────────
const resetPassword = async (
  token: string | null,
  payload: { email?: string; password: string },
  user?: { email: string },
) => {
  let userEmail: string;

  // Case 1: Token-based reset (from forgot password email)
  if (token) {
    const decodedToken = jwtHelpers.verifyToken(
      token,
      config.jwt.reset_pass_secret as Secret,
    );

    if (!decodedToken) {
      throw new ApiError(
        httpStatus.FORBIDDEN,
        "Invalid or expired reset token!",
      );
    }

    if (payload.email && decodedToken.email !== payload.email) {
      throw new ApiError(
        httpStatus.FORBIDDEN,
        "Email mismatch! Invalid reset request.",
      );
    }

    userEmail = decodedToken.email;
  }
  // Case 2: Authenticated user with needPasswordChange
  else if (user?.email) {
    const authenticatedUser = await prisma.user.findFirst({
      where: {
        email: user.email,
        isDeleted: false,
      },
      select: {
        email: true,
        needPasswordChange: true,
      },
    });

    if (!authenticatedUser) {
      throw new ApiError(httpStatus.NOT_FOUND, "User not found!");
    }

    if (!authenticatedUser.needPasswordChange) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "You don't need to reset your password. Use change password instead.",
      );
    }

    userEmail = user.email;
  } else {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Invalid request. Either provide a valid token or be authenticated.",
    );
  }

  const hashedPassword = await bcrypt.hash(
    payload.password,
    Number(config.salt_round),
  );

  await prisma.user.update({
    where: { email: userEmail },
    data: {
      password: hashedPassword,
      needPasswordChange: false,
    },
  });

  // Clear cache after password reset
  await clearUserCache(userEmail);

  return {
    message: "Password reset successfully!",
  };
};

// ─── Get Me ───────────────────────────────────────────────────────────────────
const getMe = async (user: any) => {
  const accessToken = user.accessToken;

  const decodedData = jwtHelpers.verifyToken(
    accessToken,
    config.jwt.jwt_secret as Secret,
  );

  const userData = await prisma.user.findFirst({
    where: {
      email: decodedData.email,
      isDeleted: false,
    },
    select: {
      id: true,
      email: true,
      role: true,
      needPasswordChange: true,
      isDeleted: true,
      createdAt: true,
      updatedAt: true,

      admin: {
        select: {
          id: true,
          userId: true,
          roleLabel: true,
          lastLogin: true,
        },
      },

      teacher: {
        include: {
          department: true,
          subjectGroups: true,
        },
      },

      student: {
        include: {
          department: true,
          group: {
            include: {
              currentSemester: true,
              shift: true,
            },
          },
          attendanceRecords: true,
          diplomaResults: true,
        },
      },
    },
  });

  if (!userData) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found!");
  }

  return userData;
};

// ─── Export ───────────────────────────────────────────────────────────────────
export const AuthServices = {
  loginUser,
  refreshToken,
  changePassword,
  resetPassword,
  getMe,
  clearUserCache,
};