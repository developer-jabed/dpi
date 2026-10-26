import express from "express";
import { enrollmentController } from "./enrollment.controller";
import { enrollmentValidation } from "./enrollment.validation";
import auth from "../../middlewares/auth"; // your existing auth middleware
import { Role } from "@prisma/client";
import validateRequest from "../../middlewares/validateRequest";

const router = express.Router();

router.post(
  "/promote-batch",
  auth(Role.ADMIN),
  validateRequest(enrollmentValidation.promoteBatch),
  enrollmentController.promoteBatch
);

router.post(
  "/promote-student",
  auth(Role.ADMIN),
  validateRequest(enrollmentValidation.promoteSingleStudent),
  enrollmentController.promoteSingleStudent
);

router.post(
  "/apply-result",
  auth(Role.ADMIN),
  validateRequest(enrollmentValidation.applyResult),
  enrollmentController.applyResult
);

router.get(
  "/active/:studentId",
  auth(Role.ADMIN, Role.TEACHER, Role.STUDENT),
  enrollmentController.getActiveEnrollment
);

router.get(
  "/history/:studentId",
  auth(Role.ADMIN, Role.TEACHER, Role.STUDENT),
  enrollmentController.getEnrollmentHistory
);

export const enrollmentRoutes = router;