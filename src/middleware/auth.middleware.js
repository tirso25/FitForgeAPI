import jwt from 'jsonwebtoken';

export const authenticate = (req, res, next) => {
    try {
        let token = req.cookies?.token;

        if (!token && req.headers.authorization?.startsWith('Bearer ')) {
            token = req.headers.authorization.split(' ')[1];
        }

        if (!token) {
            return res.status(401).json({ type: 'error', message: 'No token provided' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        req.user = {
            userId: decoded.userId,
            username: decoded.username,
        };

        next();
    } catch (error) {
        return res.status(401).json({ type: 'error', message: 'Invalid or expired token' });
    }
}
