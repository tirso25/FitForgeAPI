import { pool } from '../db.js';
import { sanitize, validate } from '../utils/validators.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import path from 'path';
import transporter from '../services/mailer.service.js';

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

        const verificationCode = String(Math.floor(Math.random() * 1000000)).padStart(6, '0');

        const { rows } = await pool.query(
            `INSERT INTO users (email, username, password, "verificationCode") VALUES ($1, $2, $3, $4) RETURNING "userId", email, username`,
            [email, username, hashedPassword, verificationCode]
        );

        // Auto-send verification email
        try {
            const html = buildVerificationEmailHtml(username, verificationCode, email);
            const svgPath = path.join(process.cwd(), 'public', 'img', 'weighs.svg');
            await transporter.sendMail({
                from: `"FitForge" <${process.env.GMAIL_EMAIL}>`,
                to: email,
                subject: '\u{1F510} Your FitForge Verification Code',
                html,
                attachments: [{
                    filename: 'weighs.svg',
                    path: svgPath,
                    cid: 'fitforgelogo'
                }]
            });
        } catch (emailError) {
            console.error('Error sending verification email:', emailError);
            // User is created but email failed — they can resend later
        }

        const message = randomMessage(signUpMessages, rows[0].username);
        const encryptedEmail = encryptData(email);
        return res.status(201).json({ type: 'success', message, user: rows[0], email, encryptedEmail });
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

// ── Helper: encrypt data (email, code, etc) ─────────────
function encryptData(data) {
    const key = crypto.createHash('sha256').update(process.env.JWT_SECRET).digest();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(String(data), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
}

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:4000';

// ── Helper: build verification email HTML ──────────────
function buildVerificationEmailHtml(username, verificationCode, email) {
    const encryptedCode = encryptData(verificationCode);
    const encryptedEmail = encryptData(email);
    const checkCodeUrl = `${FRONTEND_URL}/checkCode?e=${encodeURIComponent(encryptedEmail)}&c=${encodeURIComponent(encryptedCode)}`;

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#0f172a;font-family:'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#0f172a;padding:40px 20px;">
        <tr>
            <td align="center">
                <table role="presentation" width="480" cellspacing="0" cellpadding="0" border="0" style="max-width:480px;width:100%;">
                    <tr>
                        <td align="center" style="padding:30px 0 20px 0;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                                <tr>
                                    <td style="background:linear-gradient(135deg,#3b82f6,#6366f1);border-radius:16px;padding:14px;">
                                        <img src="cid:fitforgelogo" alt="FitForge" width="40" height="40" style="display:block;" />
                                    </td>
                                    <td style="padding-left:14px;">
                                        <span style="font-size:26px;font-weight:700;color:#e2e8f0;letter-spacing:-0.5px;">FitForge</span>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style="background-color:#1e293b;border-radius:18px;border:1px solid rgba(148,163,184,0.1);box-shadow:0 12px 40px rgba(0,0,0,0.3);padding:40px 36px;">
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                                <tr>
                                    <td align="center" style="padding-bottom:24px;">
                                        <h1 style="margin:0;font-size:24px;font-weight:700;color:#ffffff;">Welcome to FitForge!</h1>
                                    </td>
                                </tr>
                            </table>
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                                <tr>
                                    <td align="center" style="color:#94a3b8;font-size:15px;line-height:1.7;padding-bottom:28px;">
                                        Thank you for registering, <strong style="color:#e2e8f0;">${username}</strong>.<br/>
                                        We're delighted to have you join our community.
                                    </td>
                                </tr>
                            </table>
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                                <tr><td style="padding-bottom:28px;"><div style="height:1px;background:linear-gradient(90deg,transparent,rgba(148,163,184,0.15),transparent);"></div></td></tr>
                            </table>
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                                <tr>
                                    <td align="center" style="color:#94a3b8;font-size:13px;font-weight:500;letter-spacing:0.08em;text-transform:uppercase;padding-bottom:14px;">
                                        Your verification code
                                    </td>
                                </tr>
                            </table>
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                                <tr>
                                    <td align="center" style="padding-bottom:28px;">
                                        <div style="display:inline-block;background:rgba(59,130,246,0.1);border:1px solid rgba(59,130,246,0.2);border-radius:14px;padding:16px 36px;">
                                            <span style="font-size:34px;font-weight:700;letter-spacing:10px;color:#60a5fa;font-family:'Courier New',monospace;">${verificationCode}</span>
                                        </div>
                                    </td>
                                </tr>
                            </table>
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                                <tr><td style="padding-bottom:28px;"><div style="height:1px;background:linear-gradient(90deg,transparent,rgba(148,163,184,0.15),transparent);"></div></td></tr>
                            </table>
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                                <tr>
                                    <td align="center" style="color:#94a3b8;font-size:14px;line-height:1.6;padding-bottom:28px;">
                                        Enjoy the app and reach your goals in a smarter way! \u{1F4AA}
                                    </td>
                                </tr>
                            </table>
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                                <tr>
                                    <td align="center">
                                        <a href="${checkCodeUrl}" target="_blank" style="display:inline-block;background:linear-gradient(135deg,#3b82f6,#6366f1);color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 36px;border-radius:12px;">
                                            Verify my account
                                        </a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td align="center" style="padding:28px 0 10px 0;color:#475569;font-size:12px;">
                            &copy; ${new Date().getFullYear()} FitForge. All rights reserved.
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;
}

// ── Public: check user status by email ──────────────────
export const checkStatus = async (req, res) => {
    try {
        const email = validate.email(req.body.email);

        const { rows } = await pool.query(
            'SELECT status FROM users WHERE email = $1',
            [email]
        );

        if (rows.length === 0) {
            return res.status(404).json({ type: 'error', message: 'User not found' });
        }

        return res.status(200).json({ status: rows[0].status });
    } catch (error) {
        console.error('Error checking status:', error);
        return res.status(500).json({ type: 'error', message: 'Internal server error' });
    }
}

// ── Public: verify code by email + code, activate user ──
export const checkCode = async (req, res) => {
    try {
        const email = validate.email(req.body.email);
        const code = validate.code(req.body.code);

        const { rows } = await pool.query(
            'SELECT "userId", "verificationCode", status FROM users WHERE email = $1',
            [email]
        );

        if (rows.length === 0) {
            return res.status(404).json({ type: 'error', message: 'User not found' });
        }

        if (rows[0].status !== 'pending') {
            return res.status(400).json({ type: 'error', message: 'Account is already activated' });
        }

        if (rows[0].verificationCode !== code) {
            return res.status(401).json({ type: 'error', message: 'Invalid verification code' });
        }

        // Activate the user
        await pool.query(
            'UPDATE users SET status = $1, "verificationCode" = null WHERE email = $2',
            ['active', email]
        );

        return res.status(200).json({ type: 'success', message: 'Account activated successfully! You can now log in.' });
    } catch (error) {
        console.error('Error verifying code:', error);
        return res.status(400).json({ type: 'error', message: error.message });
    }
}

// ── Public: send/resend verification email by email ─────
export const sendEmail = async (req, res) => {
    try {
        const email = validate.email(req.body.email);

        const { rows } = await pool.query(
            'SELECT username, "verificationCode", status FROM users WHERE email = $1',
            [email]
        );

        if (rows.length === 0) {
            return res.status(404).json({ type: 'error', message: 'User not found' });
        }

        if (rows[0].status !== 'pending') {
            return res.status(400).json({ type: 'error', message: 'Account is already activated' });
        }

        const { username, verificationCode } = rows[0];
        const html = buildVerificationEmailHtml(username, verificationCode, email);
        const svgPath = path.join(process.cwd(), 'public', 'img', 'weighs.svg');

        await transporter.sendMail({
            from: `"FitForge" <${process.env.GMAIL_EMAIL}>`,
            to: email,
            subject: '\u{1F510} Your FitForge Verification Code',
            html,
            attachments: [{
                filename: 'weighs.svg',
                path: svgPath,
                cid: 'fitforgelogo'
            }]
        });

        return res.status(200).json({ type: 'success', message: 'Verification email sent successfully' });
    } catch (error) {
        console.error('Error sending email:', error);
        return res.status(500).json({ type: 'error', message: 'Internal server error' });
    }
}

// ── Public: decrypt data from email link ───────────────
export const decryptData = async (req, res) => {
    try {
        const { encrypted } = req.body;

        if (!encrypted || typeof encrypted !== 'string') {
            return res.status(400).json({ type: 'error', message: 'Missing encrypted data' });
        }

        const [ivHex, encryptedHex] = encrypted.split(':');
        if (!ivHex || !encryptedHex) {
            return res.status(400).json({ type: 'error', message: 'Invalid encrypted format' });
        }

        const key = crypto.createHash('sha256').update(process.env.JWT_SECRET).digest();
        const iv = Buffer.from(ivHex, 'hex');
        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
        let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return res.status(200).json({ decrypted });
    } catch (error) {
        console.error('Error decrypting data:', error);
        return res.status(400).json({ type: 'error', message: 'Failed to decrypt data' });
    }
}

