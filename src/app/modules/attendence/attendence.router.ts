
import express from "express";
import { attendanceController } from "./attendence.controller";

const router = express.Router();

// Session routes
router.post("/", attendanceController.createSessionWithRecords);
router.get("/", attendanceController.getAllSessions);
router.get("/:id", attendanceController.getSessionById);
router.delete("/:id", attendanceController.deleteSession);

// Record update for a session
router.patch("/:id/records", attendanceController.updateSessionRecords);

// Student attendance summary by semester
router.get(
  "/student/:studentId/semester/:semesterId",
  attendanceController.getStudentAttendanceBySemester
);

export const attendanceRoutes = router;