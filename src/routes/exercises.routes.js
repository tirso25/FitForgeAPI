import { Router } from "express";
import { getExercises, createExercise, updateExercise, deleteExercise } from '../controllers/exercises.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/exercises', authenticate, getExercises);
router.post('/createExercise', authenticate, createExercise);
router.put('/updateExercise/:id', authenticate, updateExercise);
router.delete('/deleteExercise/:id', authenticate, deleteExercise);

export default router;
