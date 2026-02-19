import express from "express";
import { shiftController } from "./shift.controller";

const router = express.Router();

router.post("/", shiftController.createShift);
router.get("/", shiftController.getAllShifts);
router.get("/:id", shiftController.getShiftById);

export const shiftRoutes = router;
