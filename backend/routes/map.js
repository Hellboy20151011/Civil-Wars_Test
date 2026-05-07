import express from 'express';
import { z } from 'zod';
import { asyncWrapper } from '../middleware/asyncWrapper.js';
import { apiLimiter } from '../middleware/rateLimiters.js';
import { validateQuery } from '../middleware/validate.js';
import { requireAuth } from './auth.js';
import * as playerRepo from '../repositories/player.repository.js';
import { config } from '../config.js';

const router = express.Router();

const mapPlayersQuerySchema = z
    .object({
        x_min: z.coerce.number().int().positive().optional(),
        y_min: z.coerce.number().int().positive().optional(),
        x_max: z.coerce.number().int().positive().optional(),
        y_max: z.coerce.number().int().positive().optional(),
    })
    .refine(
        (query) => {
            const values = [query.x_min, query.y_min, query.x_max, query.y_max];
            const providedCount = values.filter((value) => value !== undefined).length;
            return providedCount === 0 || providedCount === 4;
        },
        {
            message: 'Für Bounding-Box-Filter müssen x_min, y_min, x_max und y_max gemeinsam gesetzt sein.',
            path: ['x_min'],
        }
    )
    .refine(
        (query) =>
            query.x_min === undefined ||
            (Number(query.x_min) <= Number(query.x_max) && Number(query.y_min) <= Number(query.y_max)),
        {
            message: 'Ungültige Bounding-Box: x_min <= x_max und y_min <= y_max muss gelten.',
            path: ['x_min'],
        }
    )
    .refine(
        (query) =>
            query.x_min === undefined ||
            (Number(query.x_min) <= config.map.gridSize &&
                Number(query.x_max) <= config.map.gridSize &&
                Number(query.y_min) <= config.map.gridSize &&
                Number(query.y_max) <= config.map.gridSize),
        {
            message: `Bounding-Box liegt außerhalb des gültigen Kartenbereichs 1-${config.map.gridSize}.`,
            path: ['x_min'],
        }
    )
    .refine(
        (query) => {
            if (query.x_min === undefined) return true;
            const width = Number(query.x_max) - Number(query.x_min) + 1;
            const height = Number(query.y_max) - Number(query.y_min) + 1;
            return width * height <= config.map.maxViewportArea;
        },
        {
            message: `Bounding-Box zu groß: maximal ${config.map.maxViewportArea} Zellen erlaubt.`,
            path: ['x_min'],
        }
    );

/** GET /map/config – Kartenkonfiguration (Gittergröße, max. Spieler) */
router.get(
    '/config',
    requireAuth,
    apiLimiter,
    asyncWrapper(async (_req, res) => {
        res.json({
            grid_size: config.map.gridSize,
            max_players: config.map.maxPlayers,
            max_viewport_area: config.map.maxViewportArea,
        });
    })
);

/** GET /map/players – Alle aktiven Spieler mit ihren Kartenkoordinaten.
 * Optional: ?x_min=&y_min=&x_max=&y_max= zum Filtern auf einen Kartenausschnitt. */
router.get(
    '/players',
    requireAuth,
    apiLimiter,
    validateQuery(mapPlayersQuerySchema),
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
        const players = await playerRepo.findAllForMap(bbox);
        res.json({ players });
    })
);

export default router;
