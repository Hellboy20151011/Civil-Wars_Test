import express from 'express';
import { z } from 'zod';
import { asyncWrapper } from '../middleware/asyncWrapper.js';
import { validateBody } from '../middleware/validate.js';
import { requireAuth } from './auth.js';
import { apiLimiter } from '../middleware/rateLimiters.js';
import * as combatService from '../services/combat.service.js';

const router = express.Router();

const attackSchema = z.object({
    defender_id: z.number().int().positive('defender_id muss eine positive Zahl sein'),
    units: z
        .array(
            z.object({
                user_unit_id: z.number().int().positive(),
                quantity: z.number().int().min(1),
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
    asyncWrapper(async (req, res, next) => {
        const attackerId = req.user.id;
        const { defender_id, units } = req.body;

        try {
            const result = await combatService.launchAttack(attackerId, defender_id, units);
            res.status(201).json({
                message: `Angriff gestartet! Einheiten kommen in ${result.arrivalTime.toISOString()} an.`,
                data: result,
            });
        } catch (error) {
            error.status = 400;
            return next(error);
        }
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

export default router;
