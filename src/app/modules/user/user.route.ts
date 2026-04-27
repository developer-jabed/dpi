import {  Router } from 'express';
import { userController } from './user.controller';
import { fileUploader } from '../../helper/fileUploader';
import { Role } from '@prisma/client';
import auth from '../../middlewares/auth';


const router = Router();


router.post(
  "/create-admin",
  fileUploader.upload.single("file"),
  (req, res, next) => {
    try {

      if (req.body.data) {
        req.body = JSON.parse(req.body.data)
      }

      return userController.createAdmin(req, res, next)

    } catch (error) {
      return res.status(400).json({
        success: false,
        message: "Invalid JSON format"
      })
    }
  }
)


router.post(
  "/create-student",
  fileUploader.upload.single("file"),
  (req, res, next) => {
    try {

      if (req.body.data) {
        req.body = JSON.parse(req.body.data)

      }

      return userController.createStudent(req, res, next)

    } catch (error) {
      return res.status(400).json({
        success: false,
        message: "Invalid JSON format"
      })
    }
  }
)

router.post(
  "/create-teacher",
  fileUploader.upload.single("file"),
  (req, res, next) => {
    try {

      if (req.body.data) {
        req.body = JSON.parse(req.body.data)
      }

      return userController.createTeacher(req, res, next)

    } catch (error) {
      return res.status(400).json({
        success: false,
        message: "Invalid JSON format"
      })
    }
  }
)



router.patch(
  "/update-profile",
  auth(Role.STUDENT, Role.TEACHER),   
  fileUploader.upload.single("file"),
  (req, res, next) => {
    try {
      if (req.body.data) {
        req.body = JSON.parse(req.body.data);
      }
      return userController.updateProfile(req, res, next);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: "Invalid JSON format",
      });
    }
  }
);








export const userRoutes = router;