import { pool } from '../db.js';
import { validate, sanitize } from '../utils/validators.js';

export const getExercises = async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM exercises');
        res.status(200).json(rows);
    } catch (error) {
        console.error('Error fetching exercises:', error);
        res.status(500).json({ error: 'Error fetching exercises' });
    }
};

export const getExerciseById = async (req, res) => {
    try {
        const { id } = req.params;

        const { rows } = await pool.query('SELECT * FROM exercises WHERE id = $1', [id]);

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Exercise not found' });
        }

        res.status(200).json(rows);
    } catch (error) {
        console.error('Error getting exercise:', error);
        res.status(500).json({ error: 'Error getting exercise' });
    }
}

export const createExercise = async (req, res) => {
    try {
        const name = sanitize(validate.name(req.body.name));
        const description = sanitize(validate.description(req.body.description));
        const category_id = req.body.category_id;

        const { rows: category } = await pool.query(
            'SELECT * FROM categories WHERE id = $1',
            [category_id]
        );

        if (category.length === 0) {
            return res.status(404).json({ error: 'Category not found' });
        }

        const { rows } = await pool.query(
            'INSERT INTO exercises (name, description, category_id) VALUES ($1, $2, $3) RETURNING *',
            [name, description, category_id]
        );

        res.status(201).json({ message: 'Exercise ' + rows[0].name + ' created successfully' });
    } catch (error) {
        if (error.code === '23505') {
            return res.status(409).json({ error: 'Exercise name already exists' });
        }
        console.error('Error creating exercise:', error);
        res.status(500).json({ error: 'Error creating exercise' });
    }
};

export const updateExercise = async (req, res) => {
    const client = await pool.connect();
    try {
        const name = sanitize(validate.name(req.body.name));
        const description = sanitize(validate.description(req.body.description));
        const category_id = req.body.category_id;

        await client.query('BEGIN');

        const { rows: category } = await client.query(
            'SELECT * FROM categories WHERE id = $1',
            [category_id]
        );

        if (category.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Category not found' });
        }

        const { rows } = await client.query(
            'UPDATE exercises SET name = $1, description = $2, category_id = $3 WHERE id = $4 RETURNING *',
            [name, description, category_id, req.params.id]
        );

        if (rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Exercise not found' });
        }

        await client.query('COMMIT');
        res.status(200).json({ message: 'Exercise ' + rows[0].name + ' updated successfully' });
    } catch (error) {
        await client.query('ROLLBACK');
        if (error.code === '23505') {
            return res.status(409).json({ error: 'Exercise name already exists' });
        }
        console.error('Error updating exercise:', error);
        res.status(500).json({ error: 'Error updating exercise' });
    } finally {
        client.release();
    }
};

export const deleteExercise = async (req, res) => {
    try {
        const { id } = req.params;
        const { rows } = await pool.query('DELETE FROM exercises WHERE id = $1 RETURNING *', [id]);

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Exercise not found' });
        }

        res.status(200).json({ message: 'Exercise ' + rows[0].name + ' deleted successfully' });
    } catch (error) {
        console.error('Error deleting exercise:', error);
        res.status(500).json({ error: 'Error deleting exercise' });
    }
}