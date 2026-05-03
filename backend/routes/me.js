import express from 'express';
import pool from '../database/db.js';
import { asyncWrapper } from '../middleware/asyncWrapper.js';
import { apiLimiter } from '../middleware/rateLimiters.js';
import { requireAuth } from './auth.js';
import * as economyService from '../services/economy.service.js';

const router = express.Router();

// GET /me  – Kompletter Spielerstatus: Ressourcen, Gebäude, Queue, Strom, Produktion
router.get(
    '/',
    requireAuth,
    apiLimiter,
    asyncWrapper(async (req, res) => {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            await economyService.applyProductionTicks(req.user.id, client);
            await economyService.processFinishedQueue(req.user.id, client);
            const status = await economyService.getSpielerStatus(req.user.id, client);
            await client.query('COMMIT');
            res.json(status);
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    })
);

export default router;
