import express from 'express';
import { userRoutes } from '../modules/user/user.route';
import { departmentRoutes } from '../modules/department/department.route';
import { shiftRoutes } from '../modules/shift/shift.route';
import { semesterRoutes } from '../modules/semester/semester.route';

const router = express.Router();

const moduleRoutes = [
{
  path : '/users',
  route : userRoutes
},
{
  path : '/departments',
  route: departmentRoutes
},
{
  path : '/shifts',
  route: shiftRoutes
},
{
  path : '/semesters',
  route : semesterRoutes
}

];

moduleRoutes.forEach(route => router.use(route.path, route.route))

export default router;