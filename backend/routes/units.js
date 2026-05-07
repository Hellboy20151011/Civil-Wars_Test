import express from 'express';
import { z } from 'zod';
import { asyncWrapper } from '../middleware/asyncWrapper.js';
import { validateBody } from '../middleware/validate.js';
import { apiLimiter } from '../middleware/rateLimiters.js';
import { requireAuth } from './auth.js';
import * as unitsService from '../services/units.service.js';

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// VALIDATION SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────

const trainSchema = z.object({
    unit_type_id: z.coerce.number().int().positive('unit_type_id muss positiv sein'),
    quantity: z.coerce.number().int().min(1, 'Menge muss mindestens 1 sein').default(1),
});

const moveSchema = z.object({
    user_unit_id: z.coerce.number().int().positive('user_unit_id muss positiv sein'),
    destination_x: z.coerce.number(),
    destination_y: z.coerce.number(),
});

const attackSchema = z.object({
    attacking_unit_id: z.coerce.number().int().positive('attacking_unit_id muss positiv sein'),
    target_unit_id: z.coerce.number().int().positive('target_unit_id muss positiv sein'),
});

// ─────────────────────────────────────────────────────────────────────────────
// GET: Alle Einheitentypen
// ─────────────────────────────────────────────────────────────────────────────

router.get(
    '/types',
    requireAuth,
    apiLimiter,
    asyncWrapper(async (req, res) => {
        const unitTypes = await unitsService.getAllUnitTypes();
        res.json(unitTypes);
    })
);

// GET: Einheiten nach Kategorie
router.get(
    '/types/category/:category',
    requireAuth,
    apiLimiter,
    asyncWrapper(async (req, res) => {
        const { category } = req.params;
        const units = await unitsService.getUnitsByCategory(category);
        res.json(units);
    })
);

// ─────────────────────────────────────────────────────────────────────────────
// GET: Meine Einheiten
// ─────────────────────────────────────────────────────────────────────────────

router.get(
    '/me',
    requireAuth,
    apiLimiter,
    asyncWrapper(async (req, res) => {
        const userId = req.user.id;
        const units = await unitsService.getUserUnits(userId);
        res.json(units);
    })
);

// ─────────────────────────────────────────────────────────────────────────────
// POST: Einheiten ausbilden
// ─────────────────────────────────────────────────────────────────────────────

router.post(
    '/train',
    requireAuth,
    apiLimiter,
    validateBody(trainSchema),
    asyncWrapper(async (req, res) => {
        const userId = req.user.id;
        const { unit_type_id, quantity } = req.body;

        const result = await unitsService.startTraining(userId, unit_type_id, quantity);
        res.json({
            success: true,
            message: `${quantity}x ${result.unit} wird ausgebildet`,
            data: result,
        });
    })
);

// ─────────────────────────────────────────────────────────────────────────────
// POST: Einheiten bewegen
// ─────────────────────────────────────────────────────────────────────────────

router.post(
    '/move',
    requireAuth,
    apiLimiter,
    validateBody(moveSchema),
    asyncWrapper(async (req, res) => {
        const userId = req.user.id;
        const { user_unit_id, destination_x, destination_y } = req.body;

        const result = await unitsService.moveUnits(
            userId,
            user_unit_id,
            destination_x,
            destination_y
        );
        res.json({
            success: true,
            message: `Einheit bewegt sich zum Ziel (${destination_x}, ${destination_y})`,
            data: result,
        });
    })
);

// ─────────────────────────────────────────────────────────────────────────────
// POST: Angriff ausführen
// ─────────────────────────────────────────────────────────────────────────────

router.post(
    '/attack',
    requireAuth,
    apiLimiter,
    validateBody(attackSchema),
    asyncWrapper(async (req, res) => {
        const userId = req.user.id;
        const { attacking_unit_id, target_unit_id } = req.body;

        const result = await unitsService.attackUnits(userId, attacking_unit_id, target_unit_id);
        res.json({
            success: true,
            message: `Angriff erfolgreich! ${result.actualDamage.toFixed(2)} Schaden verursacht`,
            data: result,
        });
    })
);

export default router;
