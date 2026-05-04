import express from 'express';
import jwt from 'jsonwebtoken';
import { asyncWrapper } from '../middleware/asyncWrapper.js';
import { apiLimiter } from '../middleware/rateLimiters.js';
import { requireAuth } from './auth.js';
import { config } from '../config.js';
import * as meService from '../services/me.service.js';
import { openUserStream } from '../services/live-updates.service.js';

const router = express.Router();

// GET /me  – Kompletter Spielerstatus: Ressourcen, Gebäude, Queue, Strom, Produktion
router.get(
    '/',
    requireAuth,
    apiLimiter,
    asyncWrapper(async (req, res) => {
        const status = await meService.getPlayerStatus(req.user.id);
        res.json(status);
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

        try {
            // Initialen Status direkt nach Verbindungsaufbau senden.
            const payload = await meService.getStreamPayload(user.id);
            res.write(`event: status\n`);
            res.write(`data: ${JSON.stringify(payload)}\n\n`);
        } catch (err) {
            closeStream();
            throw err;
        }

        req.on('close', () => {
            closeStream();
        });
    })
);

export default router;
