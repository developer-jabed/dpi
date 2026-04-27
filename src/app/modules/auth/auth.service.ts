
import * as bcrypt from 'bcryptjs';
import httpStatus from "http-status";
import { Secret } from "jsonwebtoken";
import config from "../../../config";
import { prisma } from "../../shared/prisma";
import { jwtHelpers } from "../../helper/jwtHelper";
import ApiError from "../../errors/api.error";
import { id } from 'zod/v4/locales';

const loginUser = async (payload: { email: string; password: string }) => {
    let userData;

    try {
        userData = await prisma.user.findUniqueOrThrow({
            where: {
                email: payload.email,
            }
        });
    } catch (err) {
        throw new Error("Email not found or user inactive!");
    }

    const isCorrectPassword = await bcrypt.compare(payload.password, userData.password);

    if (!isCorrectPassword) {
        throw new Error("Password incorrect!");
    }

    const accessToken = jwtHelpers.generateToken(
        { email: userData.email, role: userData.role ,id: userData.id},
        config.jwt.jwt_secret as Secret,
        config.jwt.expires_in as string
    );

    const refreshToken = jwtHelpers.generateToken(
        { email: userData.email, role: userData.role ,id: userData.id},
        config.jwt.refresh_token_secret as Secret,
        config.jwt.refresh_token_expires_in as string
    );

    return {
        accessToken,
        refreshToken,
        needPasswordChange: userData.needPasswordChange
    };
};

const refreshToken = async (token: string) => {
    let decodedData;
    try {
        decodedData = jwtHelpers.verifyToken(token, config.jwt.refresh_token_secret as Secret);
    }
    catch (err) {
        throw new Error("You are not authorized!")
    }

    const userData = await prisma.user.findUniqueOrThrow({
        where: {
            email: decodedData.email,
        }
    });

    const accessToken = jwtHelpers.generateToken({
        email: userData.email,
        role: userData.role,
        id: userData.id
    },
        config.jwt.jwt_secret as Secret,
        config.jwt.expires_in as string
    );

    const refreshToken = jwtHelpers.generateToken({
        email: userData.email,
        role: userData.role,
        id: userData.id
    },
        config.jwt.refresh_token_secret as Secret,
        config.jwt.refresh_token_expires_in as string
    );

    return {
        accessToken,
        refreshToken,
        needPasswordChange: userData.needPasswordChange
    };

};

const changePassword = async (user: any, payload: any) => {
    const userData = await prisma.user.findUniqueOrThrow({
        where: {
            email: user.email,
        }
    });

    const isCorrectPassword: boolean = await bcrypt.compare(payload.oldPassword, userData.password);

    if (!isCorrectPassword) {
        throw new Error("Password incorrect!")
    }

    const hashedPassword: string = await bcrypt.hash(payload.newPassword, Number(config.salt_round));

    await prisma.user.update({
        where: {
            email: userData.email
        },
        data: {
            password: hashedPassword,
            needPasswordChange: false
        }
    })

    return {
        message: "Password changed successfully!"
    }
};



const resetPassword = async (token: string | null, payload: { email?: string, password: string }, user?: { email: string }) => {
    let userEmail: string;

    // Case 1: Token-based reset (from forgot password email)
    if (token) {
        const decodedToken = jwtHelpers.verifyToken(token, config.jwt.reset_pass_secret as Secret)

        if (!decodedToken) {
            throw new ApiError(httpStatus.FORBIDDEN, "Invalid or expired reset token!")
        }

        // Verify email from token matches the email in payload
        if (payload.email && decodedToken.email !== payload.email) {
            throw new ApiError(httpStatus.FORBIDDEN, "Email mismatch! Invalid reset request.")
        }

        userEmail = decodedToken.email;
    }
    // Case 2: Authenticated user with needPasswordChange (newly created admin/doctor)
    else if (user && user.email) {
        console.log({ user }, "needpassworchange");
        const authenticatedUser = await prisma.user.findUniqueOrThrow({
            where: {
                email: user.email,

            }
        });

        // Verify user actually needs password change
        if (!authenticatedUser.needPasswordChange) {
            throw new ApiError(httpStatus.BAD_REQUEST, "You don't need to reset your password. Use change password instead.")
        }

        userEmail = user.email;
    } else {
        throw new ApiError(httpStatus.BAD_REQUEST, "Invalid request. Either provide a valid token or be authenticated.")
    }

    // hash password
    const password = await bcrypt.hash(payload.password, Number(config.salt_round));

    // update into database
    await prisma.user.update({
        where: {
            email: userEmail
        },
        data: {
            password,
            needPasswordChange: false
        }
    })
};

const getMe = async (user: any) => {
    const accessToken = user.accessToken;
    const decodedData = jwtHelpers.verifyToken(
        accessToken,
        config.jwt.jwt_secret as Secret
    );

    const userData = await prisma.user.findUniqueOrThrow({
        where: {
            email: decodedData.email,
        },
        select: {
            id: true,
            email: true,
            role: true,
            needPasswordChange: true,   // ← was needPasswordChange
            isDeleted: true,        // ← was status
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
                    subjectGroups: {
                        select: {
                            id: true,
                            teacherId: true,
                            subjectId: true,
                            groupId: true,
                            semesterId: true,
                        },
                    },
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

    return userData;
};


export const AuthServices = {
    loginUser,
    refreshToken,
    changePassword,
    resetPassword,
    getMe
}