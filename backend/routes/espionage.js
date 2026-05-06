import express from 'express';
import { z } from 'zod';
import { asyncWrapper } from '../middleware/asyncWrapper.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { requireAuth } from './auth.js';
import { apiLimiter } from '../middleware/rateLimiters.js';
import * as espionageService from '../services/espionage.service.js';

const router = express.Router();

// ─── Schemas ──────────────────────────────────────────────────────────────────

const launchSchema = z.object({
    target_id: z.coerce.number().int().positive('target_id muss eine positive Zahl sein'),
    units: z
        .array(
            z.object({
                user_unit_id: z.coerce.number().int().positive(),
                quantity: z.coerce.number().int().min(1),
            })
        )
        .min(1, 'Mindestens eine Einheit erforderlich'),
});

const previewSchema = z.object({
    target_id: z.coerce.number().int().positive(),
    unit_ids: z.string().min(1),
    quantities: z.string().optional(),
});

// ─── Endpunkte ────────────────────────────────────────────────────────────────

// POST /espionage/launch – Spionage-Mission starten
router.post(
    '/launch',
    requireAuth,
    apiLimiter,
    validateBody(launchSchema),
    asyncWrapper(async (req, res) => {
        const spyPlayerId = req.user.id;
        const { target_id, units } = req.body;

        const result = await espionageService.launchSpyMission(spyPlayerId, target_id, units);
        res.status(201).json({
            message: `Spionage-Mission gestartet! Spione kommen in ${result.arrivalTime.toISOString()} an.`,
            data: result,
        });
    })
);

// GET /espionage/preview?target_id=&unit_ids=1,2 – Reisezeit + Treibstoff
router.get(
    '/preview',
    requireAuth,
    validateQuery(previewSchema),
    asyncWrapper(async (req, res) => {
        const unitIds = String(req.query.unit_ids)
            .split(',')
            .map((value) => Number(value))
            .filter((value) => Number.isInteger(value) && value > 0);

        const quantities = req.query.quantities
            ? String(req.query.quantities)
                .split(',')
                .map((value) => Number(value))
            : [];

        const units = unitIds.map((userUnitId, index) => ({
            user_unit_id: userUnitId,
            quantity: Number.isFinite(quantities[index]) && quantities[index] > 0
                ? Math.floor(quantities[index])
                : 1,
        }));

        const preview = await espionageService.getMissionPreview(
            req.user.id,
            req.query.target_id,
            units
        );
        res.json({ data: preview });
    })
);

// GET /espionage/missions – Laufende Missionen
router.get(
    '/missions',
    requireAuth,
    asyncWrapper(async (req, res) => {
        const missions = await espionageService.getActiveMissions(req.user.id);
        res.json({ data: missions });
    })
);

// GET /espionage/reports – Abgeschlossene Berichte
router.get(
    '/reports',
    requireAuth,
    asyncWrapper(async (req, res) => {
        const reports = await espionageService.getReports(req.user.id);
        res.json({ data: reports });
    })
);

export default router;
