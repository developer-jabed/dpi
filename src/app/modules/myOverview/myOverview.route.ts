import express from "express";
import { overviewController } from "./myOverview.controller";
import auth from "../../middlewares/auth";

const router = express.Router();

router.get(
  "/my",
  auth("TEACHER", "STUDENT"),
  overviewController.getMyOverview
);

export const overviewRoutes = router;