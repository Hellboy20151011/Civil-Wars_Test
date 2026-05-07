import express from 'express';
import { asyncWrapper } from '../middleware/asyncWrapper.js';
import { apiLimiter } from '../middleware/rateLimiters.js';
import { requireAuth } from './auth.js';
import pool from '../database/db.js';
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

/** GET /map/players – Alle aktiven Spieler mit ihren Kartenkoordinaten.
 * Optional: ?x_min=&y_min=&x_max=&y_max= zum Filtern auf einen Kartenausschnitt. */
router.get(
    '/players',
    requireAuth,
    apiLimiter,
    asyncWrapper(async (req, res) => {
        const { x_min, y_min, x_max, y_max } = req.query;
        const bbox =
            x_min !== undefined && y_min !== undefined && x_max !== undefined && y_max !== undefined
                ? {
                      xMin: Number(x_min),
                      yMin: Number(y_min),
                      xMax: Number(x_max),
                      yMax: Number(y_max),
                  }
                : null;
        const players = await playerRepo.findAllForMap(pool, bbox);
        res.json({ players });
    })
);

export default router;
