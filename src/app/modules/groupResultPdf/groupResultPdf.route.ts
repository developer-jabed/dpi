import express from "express";
import auth from "../../middlewares/auth"; // adjust path to your actual auth middleware location
import { groupResultPdfController } from "./groupResultPdf.controller";

const router = express.Router();

router.get(
  "/:groupId",
//   auth("ADMIN", "TEACHER"),
  groupResultPdfController.generateDiplomaReport
);

export const groupResultPdfRoutes = router;