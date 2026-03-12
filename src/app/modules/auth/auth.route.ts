
import express, { NextFunction, Request, Response } from 'express';
import auth from '../../middlewares/auth';
import { authLimiter } from '../../middlewares/rateLimiter';
import { AuthController } from './auth.controller';
import { Role } from '@prisma/client';

const router = express.Router();

router.post(
    '/login',
    authLimiter,
    AuthController.loginUser
);

router.post(
    '/refresh-token',
    AuthController.refreshToken
)

router.post(
    '/change-password',
    auth(
   
        Role.ADMIN,
        Role.STUDENT,
        Role.TEACHER
    ),
    AuthController.changePassword
);



router.post(
    '/reset-password',
    (req: Request, res: Response, next: NextFunction) => {


        if (!req.headers.authorization && req.cookies.accessToken) {
            console.log(req.headers.authorization, "from reset password route guard");
            console.log(req.cookies.accessToken, "from reset password route guard");
            auth(
                Role.ADMIN,
                Role.STUDENT,
                Role.TEACHER
            )(req, res, next);
        } else {
      
            next();
        }
    },
    AuthController.resetPassword
)

router.get(
    '/me',
    auth(
        Role.ADMIN,
        Role.STUDENT,
        Role.TEACHER
    ),
    AuthController.getMe
)

export const AuthRoutes = router;