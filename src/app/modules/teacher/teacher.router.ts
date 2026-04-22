import express from 'express';
import { teacherController } from './teacher.controller';

const router = express.Router();

// GET ALL
router.get('/', teacherController.getAllTeachers);

// GET SINGLE
// router.get('/:id', teacherController.getSingleTeacher);

export const TeacherRoutes = router;