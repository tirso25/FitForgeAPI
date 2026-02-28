import { Router } from 'express';
import { handleChatMessage, fetchChatHistory, deleteData } from '../controllers/chatbot.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = Router();

/**
 * @swagger
 * /api/chatbot/message:
 *   post:
 *     summary: Send a message to the chatbot
 *     tags: [Chatbot]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [message]
 *             properties:
 *               message:
 *                 type: string
 *                 description: The message to send to the chatbot
 *     responses:
 *       200:
 *         description: Chatbot response
 *       401:
 *         description: No token or invalid token
 */
router.post('/message', authenticate, handleChatMessage);

/**
 * @swagger
 * /api/chatbot/history:
 *   get:
 *     summary: Get chat history
 *     tags: [Chatbot]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Chat history
 *       401:
 *         description: No token or invalid token
 */
router.get('/history', authenticate, fetchChatHistory);

/**
 * @swagger
 * /api/chatbot/history:
 *   delete:
 *     summary: Delete chat history
 *     tags: [Chatbot]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Chat history deleted successfully
 *       401:
 *         description: No token or invalid token
 */
router.delete('/history', authenticate, deleteData);

export default router;
