import { Router } from "express";
import { signUp, signIn, signOut, refresh, decryptData, checkCode, sendEmail, googleLogin, checkStatus } from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = Router();

/**
 * @swagger
 * /api/auth/signup:
 *   post:
 *     summary: Register a new user and send verification email
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
 *         description: User created and verification email sent
 *       400:
 *         description: Validation error or passwords do not match
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
 * /api/auth/checkStatus:
 *   post:
 *     summary: Check the status of a user by email (public)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Returns the user status (pending, active, inactive)
 *       404:
 *         description: User not found
 */
router.post('/checkStatus', checkStatus);

/**
 * @swagger
 * /api/auth/checkCode:
 *   post:
 *     summary: Verify a 6-digit code and activate the user (public)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, code]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               code:
 *                 type: string
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: Account activated successfully
 *       400:
 *         description: Invalid code format or account already activated
 *       401:
 *         description: Invalid verification code
 *       404:
 *         description: User not found
 */
router.post('/checkCode', checkCode);

/**
 * @swagger
 * /api/auth/sendEmail:
 *   post:
 *     summary: Send or resend verification email (public)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Verification email sent successfully
 *       400:
 *         description: Account already activated
 *       404:
 *         description: User not found
 */
router.post('/sendEmail', sendEmail);

/**
 * @swagger
 * /api/auth/decryptData:
 *   post:
 *     summary: Decrypt an encrypted parameter from the email link (public)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [encrypted]
 *             properties:
 *               encrypted:
 *                 type: string
 *     responses:
 *       200:
 *         description: Returns the decrypted string
 *       400:
 *         description: Invalid or missing encrypted data
 */
router.post('/decryptData', decryptData);

router.post('/google', googleLogin);

export default router;
