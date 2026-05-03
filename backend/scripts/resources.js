import express from 'express';
import { asyncWrapper } from '../middleware/asyncWrapper.js';
import { apiLimiter } from '../middleware/rateLimiters.js';
import { requireAuth } from './auth.js';
import * as resourcesRepo from '../repositories/resources.repository.js';

const router = express.Router();

// GET /resources/me  – Ressourcen des eingeloggten Users
router.get('/me', requireAuth, apiLimiter, asyncWrapper(async (req, res) => {
    const resources = await resourcesRepo.findByUserId(req.user.id);
    res.json({ resources: resources ?? { geld: 0, stein: 0, stahl: 0, eisen: 0, treibstoff: 0, strom: 0 } });
}));

export default router;
