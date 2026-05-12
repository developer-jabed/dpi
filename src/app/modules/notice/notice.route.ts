import express, { NextFunction, Request, Response } from "express";

import { noticeController } from "./notice.controller";

const router = express.Router();

router.post("/", (req: Request, res: Response, next: NextFunction) => {
  return noticeController.createNotice(req, res, next);
});

router.get("/", (req: Request, res: Response, next: NextFunction) => {
  return noticeController.getAllNotices(req, res, next);
});

router.get("/:id", (req: Request, res: Response, next: NextFunction) => {
  return noticeController.getSingleNotice(req, res, next);
});

router.patch("/:id", (req: Request, res: Response, next: NextFunction) => {
  return noticeController.updateNotice(req, res, next);
});

router.delete("/:id", (req: Request, res: Response, next: NextFunction) => {
  return noticeController.deleteNotice(req, res, next);
});

export const noticeRoutes = router;
