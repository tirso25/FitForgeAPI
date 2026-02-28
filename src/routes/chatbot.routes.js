import { Router } from 'express';
import { handleChatMessage, fetchChatHistory, deleteData } from '../controllers/chatbot.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = Router();

router.post('/message', authenticate, handleChatMessage);
router.get('/history', authenticate, fetchChatHistory);
router.delete('/history', authenticate, deleteData);

export default router;
