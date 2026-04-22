// src/app/modules/student/student.routes.ts

import { Router } from 'express';
import { studentController } from './student.controller';
import auth from '../../middlewares/auth';
import { Role } from '@prisma/client';

const router = Router();



router.get(
  '/',
//   auth(Role.ADMIN),
  studentController.getAllStudents,
);

router.get(
  '/:id',
//   auth(Role.ADMIN, Role.TEACHER),
  studentController.getStudentById,
);

router.patch(
  '/:id',
//   auth(Role.ADMIN),
  studentController.updateStudent,
);

router.delete(
  '/:id',
//   auth(Role.ADMIN),
  studentController.softDeleteStudent,
);

export const studentRoutes = router;