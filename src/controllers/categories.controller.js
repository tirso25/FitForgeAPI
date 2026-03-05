import { pool } from '../db.js';
import { validate, sanitize } from '../utils/validators.js';

export const getCategories = async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM categories');

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Categories not found' });
        }

        res.status(200).json(rows);
    } catch (error) {
        console.error('Error getting categories:', error);
        res.status(500).json({ error: 'Error getting categories' });
    }
}

export const getCategoryById = async (req, res) => {
    try {
        const { id } = req.params;
        const { rows } = await pool.query('SELECT * FROM categories WHERE id = $1', [id]);

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Category not found' });
        }

        res.status(200).json(rows);
    } catch (error) {
        console.error('Error getting category:', error);
        res.status(500).json({ error: 'Error getting category' });
    }
}

export const createCategory = async (req, res) => {
    try {
        const name = sanitize(validate.name(req.body.name));

        const { rows } = await pool.query(
            'INSERT INTO categories (name) VALUES ($1) RETURNING *',
            [name]
        );

        res.status(201).json({ message: 'Category ' + rows[0].name + ' created successfully' });
    } catch (error) {
        if (error.code === '23505') {
            return res.status(409).json({ error: 'Category name already exists' });
        }
        console.error('Error creating category:', error);
        res.status(500).json({ error: 'Error creating category' });
    }
}

export const updateCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const name = sanitize(validate.name(req.body.name));
        const description = sanitize(validate.description(req.body.description));

        await client.query('BEGIN');

        const { rows } = await client.query(
            'UPDATE categories SET name = $1, description = $2 WHERE id = $3 RETURNING *',
            [name, description, id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Category not found' });
        }

        await client.query('COMMIT');
        res.status(200).json({ message: 'Category ' + rows[0].name + ' updated successfully' });
    } catch (error) {
        await client.query('ROLLBACK');
        if (error.code === '23505') {
            return res.status(409).json({ error: 'Category name already exists' });
        }
        console.error('Error updating category:', error);
        res.status(500).json({ error: 'Error updating category' });
    }
}

export const deleteCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const { rows } = await pool.query('DELETE FROM categories WHERE id = $1 RETURNING *', [id]);

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Category not found' });
        }

        res.status(200).json({ message: 'Category ' + rows[0].name + ' deleted successfully' });
    } catch (error) {
        console.error('Error deleting category:', error);
        res.status(500).json({ error: 'Error deleting category' });
    }
}
