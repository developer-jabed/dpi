import express from 'express';
import { userRoutes } from '../modules/user/user.route';
import { departmentRoutes } from '../modules/department/department.route';
import { shiftRoutes } from '../modules/shift/shift.route';
import { semesterRoutes } from '../modules/semester/semester.route';
import { resultParserRoutes } from '../modules/result-parser/resultParser.route';
import { AuthRoutes } from '../modules/auth/auth.route';
import { subjectRoutes } from '../modules/subject/subject.route';
import { subjectGroupRouter } from '../modules/subjectGroup/subjectGroup.route';

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
},
{
  path : '/result-parser',
  route: resultParserRoutes
},
{
  path : '/auth',
  route: AuthRoutes
},
{
  path : '/subjects',
  route: subjectRoutes
},
{
  path : '/subject-groups',
  route: subjectGroupRouter
}

];

moduleRoutes.forEach(route => router.use(route.path, route.route))

export default router;