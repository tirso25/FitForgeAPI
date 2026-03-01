import { pool } from '../db.js';
import { sanitize, validate } from '../utils/validators.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import path from 'path';
import { OAuth2Client } from 'google-auth-library';
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
            await transporter.sendMail({
                from: `"FitForge" <${process.env.GMAIL_EMAIL}>`,
                to: email,
                subject: '\u{1F510} Your FitForge Verification Code',
                html
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
                ? 'SELECT "userId", username, email, password, status FROM users WHERE email = $1'
                : 'SELECT "userId", username, email, password, status FROM users WHERE username = $1',
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
            const verificationCode = Math.floor(100000 + Math.random() * 900000);

            await pool.query(
                'UPDATE users SET "verificationCode" = $1 WHERE "userId" = $2',
                [verificationCode, user.userId]
            );

            // Re-send verification email
            const fullStringCode = String(verificationCode).padStart(6, '0');
            const encryptedEmailArg = encryptData(user.email);

            try {
                const html = buildVerificationEmailHtml(user.username, fullStringCode, user.email);
                const svgPath = path.join(process.cwd(), 'public', 'img', 'weighs.svg');
                await transporter.sendMail({
                    from: `"FitForge" <${process.env.GMAIL_EMAIL}>`,
                    to: user.email,
                    subject: '\u{1F510} Your FitForge Verification Code',
                    html,
                    attachments: [{
                        filename: 'weighs.svg',
                        path: svgPath,
                        cid: 'fitforgelogo'
                    }]
                });
            } catch (emailError) {
                console.error('Error resending verification email:', emailError);
            }

            return res.status(403).json({
                type: 'pending_activation',
                message: 'Check your email to activate your account. A new email has been sent.',
                encryptedEmail: encryptedEmailArg
            });
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
            secure: true,
            sameSite: 'none',
            path: '/',
            maxAge: 30 * 60 * 1000
        });

        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: true,
            sameSite: 'none',
            path: '/',
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
        res.clearCookie('token', { path: '/', secure: true, sameSite: 'none' });
        res.clearCookie('refreshToken', { path: '/', secure: true, sameSite: 'none' });

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
            secure: true,
            sameSite: 'none',
            path: '/',
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
function buildVerificationEmailHtml(username, verificationCode, email, type = 'signUp') {
    const encryptedCode = encryptData(verificationCode);
    const encryptedEmail = encryptData(email);

    const actionUrl = type === 'changePassword'
        ? `${FRONTEND_URL}/changePassword?c=${encodeURIComponent(encryptedCode)}`
        : `${FRONTEND_URL}/checkCode?e=${encodeURIComponent(encryptedEmail)}&c=${encodeURIComponent(encryptedCode)}`;

    const title = type === 'changePassword' ? 'Change Password' : 'Welcome to FitForge!';
    const messageHtml = type === 'changePassword'
        ? `You have requested to reset your password, <strong style="color:#e2e8f0;">${username}</strong>.<br/>Here is your verification code to proceed.`
        : `Thank you for registering, <strong style="color:#e2e8f0;">${username}</strong>.<br/>We're delighted to have you join our community.`;
    const buttonText = type === 'changePassword' ? 'Reset Password' : 'Verify my account';

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
                                        <img src="${FRONTEND_URL}/img/weighs.png" alt="FitForge" width="40" height="40" style="display:block;" />
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
                                        <h1 style="margin:0;font-size:24px;font-weight:700;color:#ffffff;">${title}</h1>
                                    </td>
                                </tr>
                            </table>
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                                <tr>
                                    <td align="center" style="color:#94a3b8;font-size:15px;line-height:1.7;padding-bottom:28px;">
                                        ${messageHtml}
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
                                        <a href="${actionUrl}" target="_blank" style="display:inline-block;background:linear-gradient(135deg,#3b82f6,#6366f1);color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 36px;border-radius:12px;">
                                            ${buttonText}
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

export const checkEmail = async (req, res) => {
    try {
        const email = validate.email(req.body.email);
        const type = req.body.type || 'changePassword';

        const { rows } = await pool.query(
            'SELECT "userId", username, status FROM users WHERE email = $1',
            [email]
        );

        if (rows.length === 0) {
            return res.status(404).json({ type: 'error', message: 'User not found' });
        }

        const user = rows[0];

        if (user.status === 'inactive') {
            return res.status(200).json({ status: 'inactive', message: 'Account deactivated' });
        }

        // Generate a new 6-digit verification code
        const verificationCode = crypto.randomInt(100000, 999999).toString();

        // Save the new code in the database
        await pool.query(
            'UPDATE users SET "verificationCode" = $1 WHERE email = $2',
            [verificationCode, email]
        );

        if (user.status === 'pending') {
            // Send standard activation email
            const html = buildVerificationEmailHtml(user.username, verificationCode, email, 'signUp');

            await transporter.sendMail({
                from: `"FitForge" <${process.env.GMAIL_EMAIL}>`,
                to: email,
                subject: '\u{1F510} Your FitForge Verification Code',
                html
            });

            return res.status(200).json({
                status: 'pending',
                message: 'Activation email resent',
                encryptedEmail: encryptData(email)
            });
        }

        // Send the change password email
        const html = buildVerificationEmailHtml(user.username, verificationCode, email, type);

        await transporter.sendMail({
            from: `"FitForge" <${process.env.GMAIL_EMAIL}>`,
            to: email,
            subject: type === 'changePassword' ? '\u{1F512} FitForge Password Reset' : '\u{1F510} Your FitForge Verification Code',
            html
        });

        return res.status(200).json({ status: user.status, message: 'Verification email sent' });
    } catch (error) {
        console.error('Error checking email:', error);
        return res.status(400).json({ type: 'error', message: error.message });
    }
}

// ── Public: verify code and change password ─────────────
export const resetPassword = async (req, res) => {
    try {
        const code = validate.code(req.body.verificationCode);
        const password = validate.password(req.body.password);

        const { rows } = await pool.query(
            'SELECT "userId", "verificationCode" FROM users WHERE "verificationCode" = $1',
            [code]
        );

        if (rows.length === 0) {
            return res.status(404).json({ type: 'error', message: 'User not found' });
        }

        if (rows[0].verificationCode !== code) {
            return res.status(401).json({ type: 'error', message: 'Invalid verification code' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await pool.query(
            'UPDATE users SET password = $1, "verificationCode" = null WHERE "verificationCode" = $2',
            [hashedPassword, code]
        );

        return res.status(200).json({ type: 'success', message: 'Password changed successfully! You can now log in.' });
    } catch (error) {
        console.error('Error resetting password:', error);
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

        await transporter.sendMail({
            from: `"FitForge" <${process.env.GMAIL_EMAIL}>`,
            to: email,
            subject: '\u{1F510} Your FitForge Verification Code',
            html
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

// ── Google OAuth Login ───────────────
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export const googleLogin = async (req, res) => {
    try {
        const { credential } = req.body;
        const rememberMe = req.body.rememberMe === true || req.body.rememberme === true;

        if (!credential) {
            return res.status(400).json({ type: 'error', message: 'No credential provided' });
        }

        const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${credential}` }
        });

        if (!userInfoResponse.ok) {
            throw new Error(`Google API rejected the token with status: ${userInfoResponse.status}`);
        }

        const payload = await userInfoResponse.json();
        const { email, name, sub: googleId } = payload;

        let { rows: existingUser } = await pool.query(
            'SELECT "userId", username, status FROM users WHERE email = $1',
            [email]
        );

        let user;

        if (existingUser.length > 0) {
            user = existingUser[0];

            if (user.status === 'inactive') {
                return res.status(403).json({ type: 'error', message: 'User is inactive' });
            }

            // Mapear cuentas existentes que inician con Google
            await pool.query(
                'UPDATE users SET "googleId" = $1, status = $2 WHERE "userId" = $3',
                [googleId, 'active', user.userId]
            );
        } else {
            // Generar una contraseña aleatoria súper segura (nunca la usarán)
            const randomPassword = crypto.randomBytes(32).toString('hex');
            const hashedPassword = await bcrypt.hash(randomPassword, 10);

            // Generar username único basado en su nombre
            const baseUsername = name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'user';
            const uniqueSuffix = Math.floor(1000 + Math.random() * 9000);
            const generatedUsername = `${baseUsername}${uniqueSuffix}`;

            const { rows: newUser } = await pool.query(
                `INSERT INTO users (email, username, password, status, "googleId") 
                 VALUES ($1, $2, $3, $4, $5) RETURNING "userId", username, status`,
                [email, generatedUsername, hashedPassword, 'active', googleId]
            );
            user = newUser[0];
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
            secure: true,
            sameSite: 'none',
            path: '/',
            maxAge: 30 * 60 * 1000
        });

        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: true,
            sameSite: 'none',
            path: '/',
            maxAge: refreshCookieMaxAge
        });

        const message = randomMessage(signInMessages, user.username);
        return res.status(200).json({ type: 'success', message, user });
    } catch (error) {
        console.error('Google login error:', error);
        return res.status(401).json({ type: 'error', message: `Google Token Error: ${error.message}` });
    }
};
