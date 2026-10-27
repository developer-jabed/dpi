import express from "express";
import { routineController } from "./routine.controller";
import auth from "../../middlewares/auth";

const router = express.Router();

// Create routine
router.post(
  "/",
  auth("ADMIN", "TEACHER"),
  routineController.createRoutine,
);

// Get all routines (filterable)
router.get(
  "/",
  auth("ADMIN", "TEACHER"),
  routineController.getAllRoutines,
);

// Get routine by group
router.get(
  "/group/:groupId",
  auth("ADMIN", "TEACHER", "STUDENT"),
  routineController.getRoutineByGroup,
);

// Get My Routine (Teacher + Student)
router.get(
  "/my",
  auth("TEACHER", "STUDENT"),
  routineController.getMyRoutines,
);

export const routineRoutes = router;