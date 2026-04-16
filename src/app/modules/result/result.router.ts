import express from 'express';
import { resultController } from './result.controller';

const router = express.Router();

// 🔹 Single result
router.get('/:roll', resultController.getResultByRoll);

// 🔹 Batch / group results
router.get('/', resultController.getAllResults);

export const resultRoutes = router;