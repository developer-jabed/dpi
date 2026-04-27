import express, { NextFunction, Request, Response } from 'express';
import { subjectController } from './subject.controller';


const router = express.Router();
router.post(
  '/',
  (req: Request, res: Response, next: NextFunction) => {
 
    if (req.body && req.body.data) {
      console.log('Found "data" field in FormData');
      try {
        const parsedData = JSON.parse(req.body.data);
        req.body = parsedData;
      } catch (err: any) {
        console.error("❌ Failed to parse 'data' as JSON:", err.message);
        console.log("Raw 'data' value was:", req.body.data);
      }
    }
  
    else {
      console.log("⚠️ req.body is empty or undefined");
    }


    next(); 
  },
  subjectController.createSubject
);

router.get('/', subjectController.getAllSubjects);

router.get('/:id', subjectController.getSingleSubject);

router.patch(
  '/:id',

  subjectController.updateSubject
);



export const subjectRoutes = router;