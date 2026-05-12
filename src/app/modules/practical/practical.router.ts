import express from "express";
import { practicalController } from "./practical.controller";

const router = express.Router();


router.post("/", practicalController.createPractical);


router.get("/", practicalController.getAllPracticals);


router.get("/:id", practicalController.getPracticalById);


router.patch("/:id", practicalController.updatePractical);


router.delete("/:id", practicalController.deletePractical);


router.post("/submissions", practicalController.createSubmission);


router.post("/submissions/bulk", practicalController.bulkCreateSubmissions);

router.get("/submissions", practicalController.getSubmissionsByPractical);


router.patch("/:practicalId/submissions/bulk", practicalController.bulkUpdateSubmissions);


router.patch("/:practicalId/submissions/:studentId", practicalController.updateSubmission);


router.delete("/:practicalId/submissions/:studentId", practicalController.deleteSubmission);

export const practicalRoutes = router;