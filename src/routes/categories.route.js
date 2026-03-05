import { Router } from 'express';
import { getCategories, getCategoryById, createCategory, updateCategory, deleteCategory } from '../controllers/categories.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/categories', authenticate, getCategories);
router.get('/category/:id', authenticate, getCategoryById);
router.post('/createCategory', authenticate, createCategory);
router.put('/updateCategory/:id', authenticate, updateCategory);
router.delete('/deleteCategory/:id', authenticate, deleteCategory);

export default router;