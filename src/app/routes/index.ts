import express from 'express';
import { userRoutes } from '../modules/user/user.route';
import { departmentRoutes } from '../modules/department/department.route';
import { shiftRoutes } from '../modules/shift/shift.route';
import { semesterRoutes } from '../modules/semester/semester.route';
import { resultParserRoutes } from '../modules/result-parser/resultParser.route';
import { AuthRoutes } from '../modules/auth/auth.route';
import { subjectRoutes } from '../modules/subject/subject.route';
import { subjectGroupRouter } from '../modules/subjectGroup/subjectGroup.route';
import { resultRoutes } from '../modules/result/result.router';
import { groupRoutes } from '../modules/group/group.route';
import { studentRoutes } from '../modules/student/student.route';
import { TeacherRoutes } from '../modules/teacher/teacher.router';
import { attendanceRoutes } from '../modules/attendence/attendence.router';
import { practicalRoutes } from '../modules/practical/practical.router';
import { eventRoutes } from '../modules/event/event.route';
import { noticeRoutes } from '../modules/notice/notice.route';

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
},
{
  path : '/results',
  route: resultRoutes
},
{
  path : '/groups',
  route: groupRoutes
},
{
  path : '/students',
  route: studentRoutes
},
{
  path : '/teachers',
  route: TeacherRoutes
},
{
  path : '/attendance',
  route: attendanceRoutes
},
{
  path: "/practicals",
  route: practicalRoutes
},
{
  path: "/events",
  route: eventRoutes
},
{
  path: "/notices",
  route:noticeRoutes
}

];

moduleRoutes.forEach(route => router.use(route.path, route.route))

export default router;