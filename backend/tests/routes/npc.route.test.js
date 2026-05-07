import express from 'express';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../routes/auth.js', () => ({
    requireAuth: (_req, _res, next) => next(),
}));

vi.mock('../../middleware/rateLimiters.js', () => ({
    apiLimiter: (_req, _res, next) => next(),
}));

vi.mock('../../services/npc.service.js', () => ({
    getNpcDebugSummary: vi.fn(),
}));

import npcRouter from '../../routes/npc.js';
import * as npcService from '../../services/npc.service.js';
import { config } from '../../config.js';
import { errorHandler } from '../../middleware/errorHandler.js';

let server;
let baseUrl;
let originalNpcDebugFlag;

beforeAll(async () => {
    originalNpcDebugFlag = config.debug.enableNpcDebugEndpoint;

    const app = express();
    app.use(express.json());
    app.use('/npc', npcRouter);
    app.use(errorHandler);

    await new Promise((resolve) => {
        server = app.listen(0, resolve);
    });

    const address = server.address();
    baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
    config.debug.enableNpcDebugEndpoint = originalNpcDebugFlag;

    await new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
    });
});

beforeEach(() => {
    vi.clearAllMocks();
    config.debug.enableNpcDebugEndpoint = true;
});

describe('GET /npc/debug/summary', () => {
    it('returns npc runtime summary when endpoint is enabled', async () => {
        npcService.getNpcDebugSummary.mockResolvedValue([
            {
                id: '2',
                username: 'KI-Angreifer',
                npc_type: 'aggressive',
                ready_buildings: 3,
                constructing_buildings: 1,
                total_units: 25,
                active_combat_missions: 1,
                active_spy_missions: 0,
            },
        ]);

        const response = await fetch(`${baseUrl}/npc/debug/summary`);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(Array.isArray(body.npcs)).toBe(true);
        expect(body.npcs).toHaveLength(1);
        expect(body.npcs[0].username).toBe('KI-Angreifer');
        expect(typeof body.tick_interval_ms).toBe('number');
    });

    it('returns 404 when endpoint is disabled', async () => {
        config.debug.enableNpcDebugEndpoint = false;

        const response = await fetch(`${baseUrl}/npc/debug/summary`);
        const body = await response.json();

        expect(response.status).toBe(404);
        expect(body.error.code).toBe('NPC_DEBUG_DISABLED');
        expect(npcService.getNpcDebugSummary).not.toHaveBeenCalled();
    });
});
