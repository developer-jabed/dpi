import express, { NextFunction, Request, Response } from 'express';
import { subjectController } from './subject.controller';

const router = express.Router();

// ── Create ────────────────────────────────────────────────────────────────────
router.post(
  '/',
  (req: Request, res: Response, next: NextFunction) => {
    if (req.body && req.body.data) {
      try {
        req.body = JSON.parse(req.body.data);
      } catch (err: any) {
        console.error("Failed to parse 'data' as JSON:", err.message);
      }
    }
    next();
  },
  subjectController.createSubject
);

// ── List (with filters: semesterId, departmentId, searchTerm, page…) ──────────
router.get('/', subjectController.getAllSubjects);

// ── Semester-wise book list (grouped) ─────────────────────────────────────────
// GET /subjects/books/grouped?departmentId=1&searchTerm=math
router.get('/books/grouped', subjectController.getGroupedBooks);

// ── Books of one semester ─────────────────────────────────────────────────────
// GET /subjects/books/semester/3?departmentId=1
router.get(
  '/books/semester/:semesterId',
  subjectController.getBooksBySemester
);

// ── Single & update (keep these last) ─────────────────────────────────────────
router.get('/:id', subjectController.getSingleSubject);

router.patch('/:id', subjectController.updateSubject);

export const subjectRoutes = router;