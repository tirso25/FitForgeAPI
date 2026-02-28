import { pool } from '../db.js';
import { sanitize, validate } from '../utils/validators.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const signUpMessages = [
    'Welcome, {{username}}. Start your transformation.',
    '{{username}}, today marks the beginning of the best version of yourself.',
    'A new beginning, {{username}}. No excuses.',
    '{{username}}, your transformation starts now.',
    'First step taken, {{username}}. Now go for it.',
];

const signInMessages = [
    'Welcome back, {{username}}. Let\'s go strong.',
    '{{username}}, today is training day.',
    'Add another day, {{username}}.',
    '{{username}}, active discipline.',
    'Give it your all, {{username}}.',
];

const randomMessage = (messages, username) => {
    const msg = messages[Math.floor(Math.random() * messages.length)];
    return msg.replace(/{{username}}/g, username);
};

export const signUp = async (req, res) => {
    try {
        const email = sanitize(validate.email(req.body.email));
        const username = sanitize(validate.username(req.body.username));
        const password = validate.password(req.body.password);
        const repeatPassword = validate.password(req.body.repeatPassword);

        if (password !== repeatPassword) {
            return res.status(400).json({ type: 'error', message: 'Passwords do not match' });
        }

        const { rows: existingUser } = await pool.query(
            'SELECT "userId" FROM users WHERE email = $1 OR username = $2',
            [email, username]
        );

        if (existingUser.length > 0) {
            return res.status(409).json({ type: 'error', message: 'Email or username already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const { rows } = await pool.query(
            `INSERT INTO users (email, username, password) VALUES ($1, $2, $3) RETURNING "userId", email, username`,
            [email, username, hashedPassword]
        );

        const message = randomMessage(signUpMessages, rows[0].username);
        return res.status(201).json({ type: 'success', message, user: rows[0] });
    } catch (error) {
        return res.status(400).json({ type: 'error', message: error.message });
    }
}

export const signIn = async (req, res) => {
    try {
        const usermail = req.body.email?.trim();
        const password = validate.password(req.body.password);
        const rememberMe = req.body.rememberMe === true || req.body.rememberme === true;

        const isEmail = usermail?.includes('@');
        const identifier = isEmail
            ? validate.email(usermail)
            : validate.username(usermail);

        const { rows: existingUser } = await pool.query(
            isEmail
                ? 'SELECT "userId", username, password, status FROM users WHERE email = $1'
                : 'SELECT "userId", username, password, status FROM users WHERE username = $1',
            [identifier]
        );

        if (existingUser.length === 0) {
            return res.status(404).json({ type: 'error', message: 'User not found' });
        }

        const user = existingUser[0];
        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            return res.status(401).json({ type: 'error', message: 'Invalid username or password' });
        }

        if (user.status === 'inactive') {
            return res.status(403).json({ type: 'error', message: 'User is inactive' });
        }

        if (user.status === 'pending') {
            return res.status(403).json({ type: 'error', message: 'Check your email to activate your account' });
        }

        const accessToken = jwt.sign(
            { userId: user.userId, username: user.username },
            process.env.JWT_SECRET,
            { expiresIn: '30m' }
        );

        const refreshExpiresIn = rememberMe ? '30d' : '1d';
        const refreshCookieMaxAge = rememberMe ? 30 * 24 * 60 * 60 * 1000 : undefined;

        const refreshToken = jwt.sign(
            { userId: user.userId, username: user.username },
            process.env.JWT_REFRESH_SECRET,
            { expiresIn: refreshExpiresIn }
        );

        res.cookie('token', accessToken, {
            httpOnly: true,
            maxAge: 30 * 60 * 1000
        });

        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            maxAge: refreshCookieMaxAge
        });

        delete user.password;

        const message = randomMessage(signInMessages, user.username);
        return res.status(200).json({ type: 'success', message, user });
    } catch (error) {
        return res.status(400).json({ type: 'error', message: error.message });
    }
}

export const signOut = async (req, res) => {
    try {
        res.clearCookie('token');
        res.clearCookie('refreshToken');

        return res.status(200).json({ type: 'success', message: 'User signed out successfully' });
    } catch (error) {
        return res.status(500).json({ type: 'error', message: error.message });
    }
}

export const refresh = async (req, res) => {
    try {
        const { refreshToken } = req.cookies;

        if (!refreshToken) {
            return res.status(401).json({ type: 'error', message: 'No refresh token provided' });
        }

        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

        const accessToken = jwt.sign(
            { userId: decoded.userId, username: decoded.username },
            process.env.JWT_SECRET,
            { expiresIn: '30m' }
        );

        res.cookie('token', accessToken, {
            httpOnly: true,
            maxAge: 30 * 60 * 1000
        });

        return res.status(200).json({ type: 'success', message: 'Token refreshed' });
    } catch (error) {
        return res.status(401).json({ type: 'error', message: 'Invalid or expired refresh token' });
    }
}

export const verifyCode = async (req, res) => {
    try {
        const { userId } = req.user;
        const { code } = req.body;

        if (!validate.code(code)) {
            return res.status(400).json({ error: 'Invalid code format' });
        }

        const { rows } = await pool.query(
            'UPDATE users SET code = $1 WHERE "userId" = $2 RETURNING *',
            [code, userId]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'User not found', });
        }

        res.status(200).json({ message: 'Code verified successfully' });
    } catch (error) {
        console.error('Error verifying code:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
