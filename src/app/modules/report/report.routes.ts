import express from "express";
import { reportController } from "./report.controller";
import auth from "../../middlewares/auth";

const router = express.Router();


router.get(
  "/my-students",
  auth("TEACHER"),
  reportController.getMyStudentReports
);


router.get(
  "/subject-group/:subjectGroupId/student/:studentId",
  auth("TEACHER"),
  reportController.getStudentReport
);

export const reportRoutes = router;