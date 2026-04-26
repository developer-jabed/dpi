import express from 'express';
import { subjectGroupController } from './subjectGroup.controller';

const router = express.Router();

// Create new subject group
router.post('/', subjectGroupController.createSubjectGroup);

// Get all subject groups
router.get('/', subjectGroupController.getAllSubjectGroups);

// Get a single subject group by ID
router.get('/:id', subjectGroupController.getSingleSubjectGroup);

// Update a subject group
router.put('/:id', subjectGroupController.updateSubjectGroup);

// Delete a subject group
router.delete('/:id', subjectGroupController.deleteSubjectGroup);

export const subjectGroupRouter = router;