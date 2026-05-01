import express from 'express';
import pool from '../database/db.js';
import { requireAuth } from './auth.js';

const router = express.Router();

// GET /resources/me  – Ressourcen des eingeloggten Users
router.get('/me', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT rt.name, ur.amount
             FROM user_resources ur
             JOIN resource_types rt ON rt.id = ur.resource_type_id
             WHERE ur.user_id = $1
             ORDER BY rt.id`,
            [req.user.id]
        );
        res.json({ resources: result.rows });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

export default router;
