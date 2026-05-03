import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../services/economy.service.js');
vi.mock('../../repositories/player.repository.js');
vi.mock('../../repositories/transaction.repository.js');
vi.mock('../../services/live-updates.service.js');
vi.mock('../../config.js', () => ({
    config: {
        gameloop: { tickIntervalMs: 60000 },
        db: {
            host: 'localhost',
            port: 5432,
            database: 'test',
            user: 'test',
            password: 'test',
            poolMax: 5,
        },
        jwt: { secret: 'test-secret-for-vitest-only-32chars!!', expiresIn: '1h' },
        cors: { origin: ['http://localhost:3000'] },
        rateLimit: { authWindowMs: 900000, authMax: 20, apiWindowMs: 60000, apiMax: 200 },
        performance: { referenceDataCacheTtlMs: 300000 },
        logging: { level: 'silent' },
        nodeEnv: 'test',
    },
}));

import * as economyService from '../../services/economy.service.js';
import * as playerRepo from '../../repositories/player.repository.js';
import { withTransaction } from '../../repositories/transaction.repository.js';
import { broadcastUserStatusUpdate } from '../../services/live-updates.service.js';
import {
    executeGameTick,
    getTickStats,
    startGameLoop,
} from '../../services/gameloop-scheduler.js';

withTransaction.mockImplementation(async (fn) => fn({}));

beforeEach(() => {
    vi.clearAllMocks();
    withTransaction.mockImplementation(async (fn) => fn({}));
});

// ---------------------------------------------------------------------------
// getTickStats
// ---------------------------------------------------------------------------
describe('getTickStats', () => {
    it('gibt tickCounter, gameLoopActive und tickIntervalMs zurück', () => {
        const stats = getTickStats();
        expect(stats).toHaveProperty('tickCounter');
        expect(stats).toHaveProperty('gameLoopActive');
        expect(stats).toHaveProperty('tickIntervalMs', 60000);
        expect(stats).toHaveProperty('tickIntervalMinutes');
    });

    it('gameLoopActive ist initial false', () => {
        const stats = getTickStats();
        expect(stats.gameLoopActive).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// executeGameTick
// ---------------------------------------------------------------------------
describe('executeGameTick', () => {
    it('verarbeitet alle aktiven Spieler', async () => {
        playerRepo.findActiveIds.mockResolvedValue([{ id: 1 }, { id: 2 }]);
        economyService.applyProductionTicks.mockResolvedValue(1);
        economyService.processFinishedQueue.mockResolvedValue(undefined);
        economyService.getSpielerStatus.mockResolvedValue({ resources: {} });
        broadcastUserStatusUpdate.mockReturnValue(undefined);

        await executeGameTick();

        expect(playerRepo.findActiveIds).toHaveBeenCalledTimes(1);
        expect(economyService.applyProductionTicks).toHaveBeenCalledTimes(2);
        expect(economyService.processFinishedQueue).toHaveBeenCalledTimes(2);
        expect(broadcastUserStatusUpdate).toHaveBeenCalledTimes(2);
    });

    it('ruft broadcastUserStatusUpdate mit Spieler-ID und Status auf', async () => {
        const fakeStatus = { resources: { geld: 1000 } };
        playerRepo.findActiveIds.mockResolvedValue([{ id: 7 }]);
        economyService.applyProductionTicks.mockResolvedValue(1);
        economyService.processFinishedQueue.mockResolvedValue(undefined);
        economyService.getSpielerStatus.mockResolvedValue(fakeStatus);
        broadcastUserStatusUpdate.mockReturnValue(undefined);

        await executeGameTick();

        expect(broadcastUserStatusUpdate).toHaveBeenCalledWith(7, fakeStatus);
    });

    it('bricht nicht ab wenn ein Spieler einen Fehler wirft', async () => {
        playerRepo.findActiveIds.mockResolvedValue([{ id: 1 }, { id: 2 }]);
        economyService.applyProductionTicks
            .mockRejectedValueOnce(new Error('DB-Fehler für Spieler 1'))
            .mockResolvedValueOnce(1);
        economyService.processFinishedQueue.mockResolvedValue(undefined);
        economyService.getSpielerStatus.mockResolvedValue({});
        broadcastUserStatusUpdate.mockReturnValue(undefined);

        // Soll keinen Fehler werfen
        await expect(executeGameTick()).resolves.not.toThrow();

        // Zweiter Spieler sollte trotzdem noch versucht werden
        expect(economyService.applyProductionTicks).toHaveBeenCalledTimes(2);
    });

    it('verarbeitet 0 Spieler ohne Fehler', async () => {
        playerRepo.findActiveIds.mockResolvedValue([]);

        await expect(executeGameTick()).resolves.not.toThrow();
        expect(broadcastUserStatusUpdate).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// startGameLoop
// ---------------------------------------------------------------------------
describe('startGameLoop', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it('startet den Intervall und ruft executeGameTick sofort auf', async () => {
        vi.useFakeTimers();
        playerRepo.findActiveIds.mockResolvedValue([]);

        startGameLoop();

        // Nur ausstehende Microtasks flushen (initiales Tick), ohne das Interval zu feuern
        await vi.advanceTimersByTimeAsync(0);

        expect(playerRepo.findActiveIds).toHaveBeenCalled();
    });
});
