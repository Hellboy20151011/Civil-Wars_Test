import express from 'express';
import { z } from 'zod';
import { asyncWrapper } from '../middleware/asyncWrapper.js';
import { validateBody } from '../middleware/validate.js';
import { apiLimiter } from '../middleware/rateLimiters.js';
import { requireAuth } from './auth.js';
import * as researchService from '../services/research.service.js';

const router = express.Router();

const startResearchSchema = z.object({
    project_id: z.coerce.number().int().positive('project_id muss eine positive Ganzzahl sein'),
});

router.get(
    '/overview',
    requireAuth,
    apiLimiter,
    asyncWrapper(async (req, res) => {
        const overview = await researchService.getOverview(req.user.id);
        res.json(overview);
    })
);

router.post(
    '/start',
    requireAuth,
    apiLimiter,
    validateBody(startResearchSchema),
    asyncWrapper(async (req, res) => {
        const result = await researchService.startResearch(req.user.id, req.body.project_id);
        res.status(201).json(result);
    })
);

export default router;
