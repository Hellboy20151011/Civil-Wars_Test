import express from 'express';
import { asyncWrapper } from '../middleware/asyncWrapper.js';
import { apiLimiter } from '../middleware/rateLimiters.js';
import { requireAuth } from './auth.js';
import * as playerRepo from '../repositories/player.repository.js';
import { config } from '../config.js';

const router = express.Router();

/** GET /map/config – Kartenkonfiguration (Gittergröße, max. Spieler) */
router.get(
    '/config',
    requireAuth,
    apiLimiter,
    asyncWrapper(async (_req, res) => {
        res.json({
            grid_size: config.map.gridSize,
            max_players: config.map.maxPlayers,
        });
    })
);

/** GET /map/players – Alle aktiven Spieler mit ihren Kartenkoordinaten */
router.get(
    '/players',
    requireAuth,
    apiLimiter,
    asyncWrapper(async (_req, res) => {
        const players = await playerRepo.findAllForMap();
        res.json({ players });
    })
);

export default router;
