import express from 'express';
import jwt from 'jsonwebtoken';
import pool from '../database/db.js';
import { asyncWrapper } from '../middleware/asyncWrapper.js';
import { apiLimiter } from '../middleware/rateLimiters.js';
import { requireAuth } from './auth.js';
import { config } from '../config.js';
import * as economyService from '../services/economy.service.js';
import { openUserStream } from '../services/live-updates.service.js';

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

// GET /me/stream?token=... – Server-Sent Events für Live-Statusupdates
router.get(
    '/stream',
    asyncWrapper(async (req, res) => {
        const token = typeof req.query.token === 'string' ? req.query.token : '';

        if (!token) {
            return res.status(401).json({ message: 'No token provided' });
        }

        let user;
        try {
            user = jwt.verify(token, config.jwt.secret);
        } catch {
            return res.status(401).json({ message: 'Invalid or expired token' });
        }

        const closeStream = openUserStream(user.id, res);

        // Initialen Status direkt nach Verbindungsaufbau senden.
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            await economyService.applyProductionTicks(user.id, client);
            await economyService.processFinishedQueue(user.id, client);
            const status = await economyService.getSpielerStatus(user.id, client);
            await client.query('COMMIT');

            res.write(`event: status\n`);
            res.write(`data: ${JSON.stringify({ status, serverTime: new Date().toISOString() })}\n\n`);
        } catch (err) {
            await client.query('ROLLBACK');
            closeStream();
            return res.status(500).json({ message: err.message });
        } finally {
            client.release();
        }

        req.on('close', () => {
            closeStream();
        });
    })
);

export default router;
