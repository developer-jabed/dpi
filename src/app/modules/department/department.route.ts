import express, { Request, Response, NextFunction } from "express";
import { departmentController } from "./department.controller";

const router = express.Router();

router.post(
  "/",
  (req: Request, res: Response, next: NextFunction) => {
    return departmentController.createDepartment(req, res, next);
  }
);
router.get(
  "/",
  (req: Request, res: Response, next: NextFunction) => {
    return departmentController.getAllDepartments(req, res, next);
  }
);
router.get(
  "/:id",
  (req: Request, res: Response, next: NextFunction) => {
    return departmentController.getDepartmentById(req, res, next);
  }
);
router.put(
  "/:id",
  (req: Request, res: Response, next: NextFunction) => {
    return departmentController.updateDepartment(req, res, next);
  }
);
router.delete(
  "/:id",
  (req: Request, res: Response, next: NextFunction) => {
    return departmentController.deleteDepartment(req, res, next);
  }
);



export const departmentRoutes = router;
