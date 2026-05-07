import express from 'express';
import { asyncWrapper } from '../middleware/asyncWrapper.js';
import { apiLimiter } from '../middleware/rateLimiters.js';
import { requireAuth } from './auth.js';
import { createServiceError } from '../services/service-error.js';
import * as npcService from '../services/npc.service.js';
import { config } from '../config.js';

const router = express.Router();

router.get(
    '/debug/summary',
    requireAuth,
    apiLimiter,
    asyncWrapper(async (_req, res) => {
        if (!config.debug.enableNpcDebugEndpoint) {
            throw createServiceError('NPC-Debug-Endpunkt ist deaktiviert', 404, 'NPC_DEBUG_DISABLED');
        }

        const npcs = await npcService.getNpcDebugSummary();

        res.json({
            npcs,
            tick_interval_ms: config.gameloop.tickIntervalMs,
        });
    })
);

export default router;
