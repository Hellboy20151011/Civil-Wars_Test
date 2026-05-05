import express from 'express';
import { z } from 'zod';
import { asyncWrapper } from '../middleware/asyncWrapper.js';
import { validateBody } from '../middleware/validate.js';
import { requireAuth } from './auth.js';
import { apiLimiter } from '../middleware/rateLimiters.js';
import * as combatService from '../services/combat.service.js';

const router = express.Router();

const attackSchema = z.object({
    defender_id: z.coerce.number().int().positive('defender_id muss eine positive Zahl sein'),
    units: z
        .array(
            z.object({
                user_unit_id: z.coerce.number().int().positive(),
                quantity: z.coerce.number().int().min(1),
            })
        )
        .min(1, 'Mindestens eine Einheit erforderlich'),
});

// POST /combat/attack – Angriff auf einen anderen Spieler starten
router.post(
    '/attack',
    requireAuth,
    apiLimiter,
    validateBody(attackSchema),
    asyncWrapper(async (req, res) => {
        const attackerId = req.user.id;
        const { defender_id, units } = req.body;

        const result = await combatService.launchAttack(attackerId, defender_id, units);
        res.status(201).json({
            message: `Angriff gestartet! Einheiten kommen in ${result.arrivalTime.toISOString()} an.`,
            data: result,
        });
    })
);

// GET /combat/missions – Eigene laufende Missionen (als Angreifer)
router.get(
    '/missions',
    requireAuth,
    asyncWrapper(async (req, res) => {
        const missions = await combatService.getActiveMissions(req.user.id);
        res.json({ data: missions });
    })
);

// GET /combat/incoming – Eingehende Angriffe auf den eigenen Account
router.get(
    '/incoming',
    requireAuth,
    asyncWrapper(async (req, res) => {
        const attacks = await combatService.getIncomingAttacks(req.user.id);
        res.json({ data: attacks });
    })
);

// GET /combat/history – Kampfhistorie (als Angreifer und Verteidiger)
router.get(
    '/history',
    requireAuth,
    asyncWrapper(async (req, res) => {
        const history = await combatService.getMissionHistory(req.user.id);
        res.json({ data: history });
    })
);

// GET /combat/history/:missionId – Einzelner Kampfbericht
router.get(
    '/history/:missionId',
    requireAuth,
    asyncWrapper(async (req, res) => {
        const missionId = Number(req.params.missionId);
        if (!Number.isInteger(missionId) || missionId <= 0) {
            return res.status(400).json({ message: 'missionId muss eine positive Zahl sein' });
        }

        const entry = await combatService.getMissionHistoryEntry(req.user.id, missionId);
        if (!entry) {
            return res.status(404).json({ message: 'Kampfbericht nicht gefunden' });
        }

        res.json({ data: entry });
    })
);

export default router;
