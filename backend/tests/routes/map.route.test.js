import express from 'express';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../routes/auth.js', () => ({
    requireAuth: (_req, _res, next) => next(),
}));

vi.mock('../../middleware/rateLimiters.js', () => ({
    apiLimiter: (_req, _res, next) => next(),
}));

vi.mock('../../repositories/player.repository.js', () => ({
    findAllForMap: vi.fn(),
}));

import mapRouter from '../../routes/map.js';
import * as playerRepo from '../../repositories/player.repository.js';

let server;
let baseUrl;

beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use('/map', mapRouter);

    await new Promise((resolve) => {
        server = app.listen(0, resolve);
    });

    const address = server.address();
    baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
    await new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
    });
});

beforeEach(() => {
    vi.clearAllMocks();
    playerRepo.findAllForMap.mockResolvedValue([]);
});

async function getJson(path) {
    const response = await fetch(`${baseUrl}${path}`);
    const body = await response.json();
    return { response, body };
}

describe('GET /map/players query validation', () => {
    it('returns map config including max viewport area', async () => {
        const { response, body } = await getJson('/map/config');

        expect(response.status).toBe(200);
        expect(typeof body.grid_size).toBe('number');
        expect(typeof body.max_players).toBe('number');
        expect(typeof body.max_viewport_area).toBe('number');
        expect(body.max_viewport_area).toBeGreaterThan(0);
    });

    it('returns 400 when bbox is only partially provided', async () => {
        const { response, body } = await getJson('/map/players?x_min=1&y_min=1&x_max=10');

        expect(response.status).toBe(400);
        expect(body.message).toContain('gemeinsam gesetzt');
        expect(playerRepo.findAllForMap).not.toHaveBeenCalled();
    });

    it('returns 400 when bbox exceeds grid bounds', async () => {
        const { response, body } = await getJson('/map/players?x_min=1&y_min=1&x_max=2000&y_max=10');

        expect(response.status).toBe(400);
        expect(body.message).toContain('außerhalb des gültigen Kartenbereichs');
        expect(playerRepo.findAllForMap).not.toHaveBeenCalled();
    });

    it('returns 400 when bbox area exceeds configured viewport max', async () => {
        const { response, body } = await getJson('/map/players?x_min=1&y_min=1&x_max=999&y_max=999');

        expect(response.status).toBe(400);
        expect(body.message).toContain('Bounding-Box zu groß');
        expect(playerRepo.findAllForMap).not.toHaveBeenCalled();
    });

    it('returns 200 and forwards parsed bbox for valid query', async () => {
        playerRepo.findAllForMap.mockResolvedValue([{ id: 7, username: 'spieler7', koordinate_x: 5, koordinate_y: 6 }]);

        const { response, body } = await getJson('/map/players?x_min=1&y_min=1&x_max=300&y_max=300');

        expect(response.status).toBe(200);
        expect(body.players).toHaveLength(1);
        expect(playerRepo.findAllForMap).toHaveBeenCalledWith({
            xMin: 1,
            yMin: 1,
            xMax: 300,
            yMax: 300,
        });
    });
});
