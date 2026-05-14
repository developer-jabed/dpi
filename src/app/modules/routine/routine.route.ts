import express from "express";
import { routineController } from "./routine.controller";
import auth from "../../middlewares/auth";

const router = express.Router();

router.post("/",  routineController.createRoutine);

router.get(
  "/",
  
  routineController.getAllRoutines,
);

router.get(
  "/group/:groupId",

  routineController.getRoutineByGroup,
);

export const routineRoutes = router;
