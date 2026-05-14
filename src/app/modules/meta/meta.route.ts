import { Router } from "express";
import auth from "../../middlewares/auth";
import { Role } from "@prisma/client";
import { dashboardController } from "./meta.controller";

const router = Router();

router.get("/admin", auth(Role.ADMIN), dashboardController.getAdminDashboard);

router.get(
  "/teacher",
  auth(Role.TEACHER),
  dashboardController.getTeacherDashboard,
);

router.get(
  "/student",
  auth(Role.STUDENT),
  dashboardController.getStudentDashboard,
);

export const dashboardRoutes = router;
