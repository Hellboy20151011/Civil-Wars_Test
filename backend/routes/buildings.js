import express from 'express';
import { z } from 'zod';
import { asyncWrapper } from '../middleware/asyncWrapper.js';
import { validateBody } from '../middleware/validate.js';
import { apiLimiter } from '../middleware/rateLimiters.js';
import { requireAuth } from './auth.js';
import * as buildingsService from '../services/buildings.service.js';

const router = express.Router();

const buildSchema = z.object({
    building_type_id: z.coerce
        .number()
        .int()
        .positive('building_type_id muss eine positive Ganzzahl sein'),
    anzahl: z.coerce.number().int().min(1, 'anzahl muss mindestens 1 sein').default(1),
});

// GET /buildings/types  – alle verfügbaren Gebäudetypen
router.get(
    '/types',
    requireAuth,
    apiLimiter,
    asyncWrapper(async (req, res) => {
        const types = await buildingsService.getBuildingTypes();
        res.json(types);
    })
);

// GET /buildings/me  – Gebäude + Queue des eingeloggten Users
router.get(
    '/me',
    requireAuth,
    apiLimiter,
    asyncWrapper(async (req, res) => {
        const status = await buildingsService.getMyBuildingsAndQueue(req.user.id);
        res.json(status);
    })
);

// GET /buildings/queue  – nur die Bauwarteschlange
router.get(
    '/queue',
    requireAuth,
    apiLimiter,
    asyncWrapper(async (req, res) => {
        const queue = await buildingsService.getMyQueue(req.user.id);
        res.json(queue);
    })
);

// POST /buildings/build  – Bau eines Gebäudes starten
router.post(
    '/build',
    requireAuth,
    apiLimiter,
    validateBody(buildSchema),
    asyncWrapper(async (req, res) => {
        try {
            const payload = await buildingsService.buildBuilding(
                req.user.id,
                req.body.building_type_id,
                req.body.anzahl
            );
            res.status(201).json(payload);
        } catch (error) {
            if (error.status) {
                return res.status(error.status).json({ message: error.message });
            }
            throw error;
        }
    })
);

export default router;
