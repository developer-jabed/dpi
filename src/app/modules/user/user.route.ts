import express, { Request, Response, NextFunction } from 'express';
import { userController } from './user.controller';
import { fileUploader } from '../../helper/fileUploader';

const router = express.Router();

// Create Admin
router.post(
  "/create-admin",
  fileUploader.upload.single('file'),
  (req: Request, res: Response, next: NextFunction) => {
    if (req.body.data) {
      req.body = JSON.parse(req.body.data); // parse incoming JSON
    }
    return userController.createAdmin(req, res, next);
  }
);

// Create CR
router.post(
  "/create-cr",
  fileUploader.upload.single('file'),
  (req: Request, res: Response, next: NextFunction) => {
    if (req.body.data) {
      req.body = JSON.parse(req.body.data);
    }
    return userController.createCR(req, res, next);
  }
);

// Create Teacher
router.post(
  "/create-teacher",
  fileUploader.upload.single('file'),
  (req: Request, res: Response, next: NextFunction) => {
    if (req.body.data) {
      req.body = JSON.parse(req.body.data);
    }
    return userController.createTeacher(req, res, next);
  }
);

// Create Student
router.post(
  "/create-student",
  fileUploader.upload.single('file'),
  (req: Request, res: Response, next: NextFunction) => {
    if (req.body.data) {
      req.body = JSON.parse(req.body.data);
    }
    return userController.createStudent(req, res, next);
  }
);

// Get All Users
router.get(
  "/",
  (req: Request, res: Response, next: NextFunction) => {
    return userController.getAllFromDB(req, res, next);
  }
);

// Update Profile
// router.patch(
//   "/update-profile/:id",
//   fileUploader.upload.single('file'),
//   (req: Request, res: Response, next: NextFunction) => {
//     if (req.body.data) {
//       req.body = JSON.parse(req.body.data);
//     }
//     return userController.updateProfile(req, res, next);
//   }
// );

export const userRoutes = router;
