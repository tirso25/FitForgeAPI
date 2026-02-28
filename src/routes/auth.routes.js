import { Router } from "express";
import { signUp, signIn, signOut, refresh, verifyCode } from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = Router();

/**
 * @swagger
 * /api/auth/signup:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, username, password, repeatPassword]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *                 format: password
 *               repeatPassword:
 *                 type: string
 *                 format: password
 *     responses:
 *       201:
 *         description: User created successfully
 *       400:
 *         description: Validation error or passwords do not match
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: Email or username already exists
 */
router.post('/signup', signUp);

/**
 * @swagger
 * /api/auth/signin:
 *   post:
 *     summary: Sign in with email or username
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 description: Email or username
 *               password:
 *                 type: string
 *                 format: password
 *               rememberMe:
 *                 type: boolean
 *                 default: false
 *     responses:
 *       200:
 *         description: Signed in successfully. Sets token and refreshToken cookies.
 *       401:
 *         description: Invalid username or password
 *       403:
 *         description: User is inactive or pending activation
 *       404:
 *         description: User not found
 */
router.post('/signin', signIn);

/**
 * @swagger
 * /api/auth/signout:
 *   post:
 *     summary: Sign out the current user
 *     tags: [Auth]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Signed out successfully. Clears cookies.
 *       401:
 *         description: No token or invalid token
 */
router.post('/signout', authenticate, signOut);

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Refresh the access token using the refresh token cookie
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Token refreshed. Sets new token cookie.
 *       401:
 *         description: No refresh token or invalid/expired refresh token
 */
router.post('/refresh', refresh);

/**
 * @swagger
 * /api/users/verifyCode:
 *   put:
 *     summary: Verify a 6-digit code for the current user
 *     tags: [Users]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code]
 *             properties:
 *               code:
 *                 type: string
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: Code verified successfully
 *       400:
 *         description: Invalid code format
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 */
router.put('/verifyCode', authenticate, verifyCode)

export default router;
