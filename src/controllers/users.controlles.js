import { pool } from '../db.js';
import { validate } from '../utils/validators.js';
import bcrypt from 'bcrypt';

export const updateUser = async (req, res) => {
    const client = await pool.connect();
    try {
        const { userId } = req.user;
        await client.query('BEGIN');

        const userUpdates = [];
        const userValues = [];
        let paramCount = 1;

        if (req.body.username !== undefined) {
            userUpdates.push(`username = $${paramCount++}`);
            userValues.push(validate.username(req.body.username));
        }

        if (req.body.password !== undefined) {
            const hashedPassword = await bcrypt.hash(validate.password(req.body.password), 10);
            userUpdates.push(`password = $${paramCount++}`);
            userValues.push(hashedPassword);
        }

        if (userUpdates.length > 0) {
            userValues.push(userId);
            const { rows } = await client.query(
                `UPDATE users SET ${userUpdates.join(', ')} WHERE "userId" = $${paramCount} RETURNING "userId"`,
                userValues
            );
            if (rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ error: 'User not found' });
            }
        }

        const weight = req.body.weight !== undefined ? validate.weight(req.body.weight) : undefined;
        const height = req.body.height !== undefined ? validate.height(req.body.height) : undefined;
        const age = req.body.age !== undefined ? validate.age(req.body.age) : undefined;
        const gender = req.body.gender !== undefined ? validate.gender(req.body.gender) : undefined;

        if (weight !== undefined && height !== undefined && age !== undefined && gender !== undefined) {
            await client.query(
                `INSERT INTO user_profiles (user_id, weight, height, age, gender, updated_at)
                 VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
                 ON CONFLICT (user_id) DO UPDATE SET
                   weight = EXCLUDED.weight,
                   height = EXCLUDED.height,
                   age = EXCLUDED.age,
                   gender = EXCLUDED.gender,
                   updated_at = CURRENT_TIMESTAMP`,
                [userId, weight, height, age, gender]
            );
        }

        await client.query('COMMIT');
        res.status(200).json({ message: 'User updated successfully' });
    } catch (error) {
        await client.query('ROLLBACK');
        if (error.code === '23505') {
            return res.status(409).json({ error: 'Email or username already exists' });
        }
        console.error('Error updating user:', error);
        res.status(400).json({ error: error.message });
    } finally {
        client.release();
    }
}

export const deleteUser = async (req, res) => {
    try {

        const { userId } = req.user;

        const { rows } = await pool.query(
            'UPDATE users SET status = \'inactive\' WHERE "userId" = $1 RETURNING *',
            [userId]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'User not found', });
        }

        res.status(200).json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

export const getMyProfile = async (req, res) => {
    try {
        const { userId } = req.user;

        const { rows } = await pool.query('SELECT u.email, u.username, u.status, u."dateUnion", up.weight, up.height, up.age, up.gender FROM users u LEFT JOIN user_profiles up ON u."userId" = up.user_id WHERE u."userId" = $1', [userId]);

        if (rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.status(200).json(rows[0]);
    } catch (error) {
        console.error('Error getting user profile:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

export const profileOk = async (req, res) => {
    try {
        const { userId } = req.user;
        const { rows } = await pool.query('SELECT * FROM user_profiles WHERE user_id = $1', [userId]);

        if (rows.length === 0) {
            return res.status(400).json({ error: 'Profile not found' });
        }

        const { weight, height, age, gender } = rows[0];
        if (!weight || !height || !age || !gender) {
            return res.status(400).json({ error: 'Profile incomplete' });
        }

        res.status(200).json(rows[0]);
    } catch (error) {
        console.error('Error getting user profile:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

export const updateProfile = async (req, res) => {
    try {
        const { userId } = req.user;

        const weight = validate.weight(req.body.weight);
        const height = validate.height(req.body.height);
        const age = validate.age(req.body.age);
        const gender = validate.gender(req.body.gender);


        await pool.query(
            `INSERT INTO user_profiles (user_id, weight, height, age, gender, updated_at)
             VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
             ON CONFLICT (user_id) DO UPDATE SET
               weight = EXCLUDED.weight,
               height = EXCLUDED.height,
               age = EXCLUDED.age,
               gender = EXCLUDED.gender,
               updated_at = CURRENT_TIMESTAMP`,
            [userId, weight, height, age, gender]
        );

        res.status(200).json({ message: 'Profile updated successfully' });
    } catch (error) {
        console.error('Error updating user profile:', error);
        res.status(400).json({ error: error.message });
    }
}

export const deleteAiInfo = async (req, res) => {
    try {
        const { userId } = req.user;

        const { rows } = await pool.query('SELECT * FROM chat_history WHERE user_id = $1', [userId]);

        if (rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        await pool.query('DELETE FROM chat_history WHERE user_id = $1', [userId]);

        res.status(200).json({ message: 'AI info deleted successfully' });
    } catch (error) {
        console.error('Error deleting AI info:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}