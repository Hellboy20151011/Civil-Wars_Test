import express from 'express';
import { asyncWrapper } from '../middleware/asyncWrapper.js';
import { apiLimiter } from '../middleware/rateLimiters.js';
import { requireAuth } from './auth.js';
import * as meService from '../services/me.service.js';
import { mountUserStream, createStreamTicket, redeemStreamTicket } from '../services/live-updates.service.js';

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

// POST /me/stream-ticket – Einmaliges kurzlebiges Ticket für die SSE-Verbindung ausstellen
// Erfordert gültigen Bearer-Token (normale Auth). Ticket ist 30 s gültig.
router.post(
    '/stream-ticket',
    requireAuth,
    apiLimiter,
    asyncWrapper(async (req, res) => {
        const ticket = createStreamTicket(req.user.id);
        res.json({ ticket });
    })
);

// GET /me/stream?ticket=... – Server-Sent Events für Live-Statusupdates
// Authentifizierung über kurzlebiges Einmal-Ticket (kein JWT im URL)
router.get(
    '/stream',
    asyncWrapper(async (req, res) => {
        const ticket = typeof req.query.ticket === 'string' ? req.query.ticket : '';

        if (!ticket) {
            return res.status(401).json({ message: 'No stream ticket provided' });
        }

        const userId = redeemStreamTicket(ticket);
        if (!userId) {
            return res.status(401).json({ message: 'Invalid or expired stream ticket' });
        }

        const closeStream = await mountUserStream(userId, res);

        req.on('close', () => {
            closeStream();
        });
    })
);

export default router;
