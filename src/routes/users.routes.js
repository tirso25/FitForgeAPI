import { Router } from "express";
import { updateUser, deleteUser, getMyProfile, changePassword, profileOk, updateProfile } from '../controllers/users.controlles.js';
import { authenticate } from '../middleware/auth.middleware.js';    

const router = Router();

/**
 * @swagger
 * /api/users/me:
 *   get:
 *     summary: Get the current user's profile
 *     tags: [Users]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: User profile
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 email:
 *                   type: string
 *                 username:
 *                   type: string
 *                 status:
 *                   type: string
 *                 dateUnion:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 */
router.get('/whoami', authenticate, getMyProfile)

/**
 * @swagger
 * /api/users/delete:
 *   put:
 *     summary: Deactivate the current user's account
 *     tags: [Users]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: User deactivated successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 */
router.put('/delete', authenticate, deleteUser)

/**
 * @swagger
 * /api/users/update:
 *   get:
 *     summary: Get current user data to prefill the update form
 *     tags: [Users]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: User profile
 *       401:
 *         description: Unauthorized
 *   put:
 *     summary: Update username and/or password
 *     tags: [Users]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: User updated successfully
 *       400:
 *         description: No fields to update or validation error
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 *       409:
 *         description: Username already taken
 */
router.get('/update', authenticate, getMyProfile)

router.put('/update', authenticate, updateUser)

/**
 * @swagger
 * /api/users/changePassword:
 *   put:
 *     summary: Change the current user's password
 *     tags: [Users]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [password, repeatPassword]
 *             properties:
 *               password:
 *                 type: string
 *                 format: password
 *               repeatPassword:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: Password changed successfully
 *       400:
 *         description: Validation error or passwords do not match
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 */
router.put('/changePassword', authenticate, changePassword)

/**
 * @swagger
 * /api/users/profile:
 *   get:
 *     summary: Get the current user's profile
 *     tags: [Users]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: User profile
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 */
router.get('/profile', authenticate, profileOk)

/**
 * @swagger
 * /api/users/profile:
 *   put:
 *     summary: Update the current user's profile
 *     tags: [Users]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               weight:
 *                 type: number
 *               height:
 *                 type: number
 *               age:
 *                 type: number
 *               gender:
 *                 type: string
 *     responses:
 *       200:
 *         description: User profile updated successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 */
router.put('/profile', authenticate, updateProfile)

export default router;