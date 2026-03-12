import { UserStatus } from "@prisma/client";
import * as bcrypt from 'bcryptjs';
import httpStatus from "http-status";
import { Secret } from "jsonwebtoken";
import config from "../../../config";
import { prisma } from "../../shared/prisma";
import { jwtHelpers } from "../../helper/jwtHelper";
import ApiError from "../../errors/api.error";

const loginUser = async (payload: { email: string; password: string }) => {
    let userData;

    try {
        userData = await prisma.user.findUniqueOrThrow({
            where: {
                email: payload.email,
                status: UserStatus.ACTIVE
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
        { email: userData.email, role: userData.role },
        config.jwt.jwt_secret as Secret,
        config.jwt.expires_in as string
    );

    const refreshToken = jwtHelpers.generateToken(
        { email: userData.email, role: userData.role },
        config.jwt.refresh_token_secret as Secret,
        config.jwt.refresh_token_expires_in as string
    );

    return {
        accessToken,
        refreshToken,
        needPasswordChange: userData.needPassChange
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
            status: UserStatus.ACTIVE
        }
    });

    const accessToken = jwtHelpers.generateToken({
        email: userData.email,
        role: userData.role
    },
        config.jwt.jwt_secret as Secret,
        config.jwt.expires_in as string
    );

    const refreshToken = jwtHelpers.generateToken({
        email: userData.email,
        role: userData.role
    },
        config.jwt.refresh_token_secret as Secret,
        config.jwt.refresh_token_expires_in as string
    );

    return {
        accessToken,
        refreshToken,
        needPasswordChange: userData.needPassChange
    };

};

const changePassword = async (user: any, payload: any) => {
    const userData = await prisma.user.findUniqueOrThrow({
        where: {
            email: user.email,
            status: UserStatus.ACTIVE
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
            needPassChange: false
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
                status: UserStatus.ACTIVE
            }
        });

        // Verify user actually needs password change
        if (!authenticatedUser.needPassChange) {
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
            needPassChange: false
        }
    })
};

const getMe = async (user: any) => {
    const accessToken = user.accessToken;
    const decodedData = jwtHelpers.verifyToken(accessToken, config.jwt.jwt_secret as Secret);

    const userData = await prisma.user.findUniqueOrThrow({
        where: {
            email: decodedData.email,
            status: UserStatus.ACTIVE
        },
        select: {
            id: true,
            email: true,
            role: true,
            needPassChange: true,
            status: true,
            createdAt: true,
            updatedAt: true,
            admin: {
                select: {
                    id: true,
                    userId: true,
                    lastLogin: true,
                }
            },
            teacher: {
                select: {
                    id: true,
                    userId: true,
                    name: true,
                    email: true,
                    profilePhoto: true,
                    mobile: true,
                    gender: true,
                    birthDate: true,
                    bio: true,
                    birthnumber: true,
                    presentAddress: true,
                    permanentAddress: true,
                    isDeleted: true,
                    expertise: true,
                }
            },
            student: {
                include: { // use include for relations
                    group: {
                        include: {
                            semester: true
                        }
                    },
                    department: true,
                    diplomaResults: true,
                    attendanceRecords: true,
                    cr: true
                },
            }
        }
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