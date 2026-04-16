import { Router } from "express";
import { groupController } from "./group.controller";

const router = Router();

router.post("/", (req, res, next) => groupController.createGroup(req, res, next));
router.get("/", (req, res, next) => groupController.getAllGroups(req, res, next));
router.get("/:id", (req, res, next) => groupController.getGroupById(req, res, next));

export const groupRoutes = router;