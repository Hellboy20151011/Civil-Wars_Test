import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../services/economy.service.js');
vi.mock('../../services/combat.service.js');
vi.mock('../../services/espionage.service.js');
vi.mock('../../repositories/player.repository.js');
vi.mock('../../repositories/transaction.repository.js');
vi.mock('../../services/live-updates.service.js');
vi.mock('../../logger.js', () => {
    const childLogger = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    };

    return {
        logger: {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            child: vi.fn(() => childLogger),
        },
    };
});
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
import * as combatService from '../../services/combat.service.js';
import * as espionageService from '../../services/espionage.service.js';
import * as playerRepo from '../../repositories/player.repository.js';
import { withTransaction } from '../../repositories/transaction.repository.js';
import { broadcastUserStatusUpdate } from '../../services/live-updates.service.js';
import { logger } from '../../logger.js';
import {
    executeGameTick,
    getTickStats,
    startGameLoop,
} from '../../services/gameloop-scheduler.js';

const childLogger = logger.child();

withTransaction.mockImplementation(async (fn) => fn({}));

beforeEach(() => {
    vi.clearAllMocks();
    withTransaction.mockImplementation(async (fn) => fn({}));
    logger.child.mockReturnValue(childLogger);
    combatService.processArrivingMissions.mockResolvedValue(undefined);
    combatService.processReturningMissions.mockResolvedValue(undefined);
    espionageService.processArrivingSpyMissions.mockResolvedValue(undefined);
    espionageService.processReturningSpyMissions.mockResolvedValue(undefined);
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
        expect(combatService.processArrivingMissions).toHaveBeenCalledTimes(1);
        expect(combatService.processReturningMissions).toHaveBeenCalledTimes(1);
        expect(espionageService.processArrivingSpyMissions).toHaveBeenCalledTimes(1);
        expect(espionageService.processReturningSpyMissions).toHaveBeenCalledTimes(1);
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

        await expect(executeGameTick()).resolves.not.toThrow();

        expect(economyService.applyProductionTicks).toHaveBeenCalledTimes(2);
        expect(childLogger.error).toHaveBeenCalledWith(
            expect.objectContaining({ userId: 1, err: expect.any(Error) }),
            'Tick processing failed for user'
        );
    });

    it('überspringt parallele Ticks wenn bereits ein Tick läuft', async () => {
        let releaseTick;
        playerRepo.findActiveIds.mockResolvedValue([{ id: 1 }]);
        withTransaction.mockImplementation(
            () => new Promise((resolve) => {
                releaseTick = () => resolve({ resources: {} });
            })
        );

        const firstTick = executeGameTick();
        const secondTick = executeGameTick();

        await Promise.resolve();
        await secondTick;

        expect(logger.warn).toHaveBeenCalledWith('[GAMELOOP] Tick already running, skipping current execution');

        releaseTick();
        await firstTick;
    });

    it('fängt kritische Fehler global ab', async () => {
        playerRepo.findActiveIds.mockRejectedValue(new Error('database offline'));

        await expect(executeGameTick()).resolves.toBeUndefined();
        expect(childLogger.error).toHaveBeenCalledWith(
            { err: expect.any(Error) },
            'Critical tick failure'
        );
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

        await vi.advanceTimersByTimeAsync(0);

        expect(playerRepo.findActiveIds).toHaveBeenCalled();
        expect(logger.info).toHaveBeenCalledWith(
            expect.objectContaining({ tickIntervalMs: 60000, tickIntervalMinutes: '1.0' }),
            'Game loop started'
        );
        expect(logger.info).toHaveBeenCalledWith('Game loop active');
    });

    it('führt Folge-Ticks über das Intervall aus', async () => {
        vi.useFakeTimers();
        playerRepo.findActiveIds.mockResolvedValue([]);

        startGameLoop();
        await vi.advanceTimersByTimeAsync(0);
        await vi.advanceTimersByTimeAsync(60000);

        expect(playerRepo.findActiveIds).toHaveBeenCalledTimes(2);
    });

    it('loggt Fehler aus runTickSafely beim initialen Tick', async () => {
        vi.useFakeTimers();
        logger.child.mockImplementationOnce(() => {
            throw new Error('forced tick setup error');
        });

        startGameLoop();
        await vi.advanceTimersByTimeAsync(0);

        expect(logger.error).toHaveBeenCalledWith(
            expect.objectContaining({ err: expect.any(Error) }),
            'Initiales Tick fehlgeschlagen'
        );
    });
});
