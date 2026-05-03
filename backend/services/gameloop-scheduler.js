/**
 * Game Loop Scheduler - Zentrale Verwaltung des Tick-Systems
 * Delegiert an economy.service.js das eigentliche Handling.
 */

import { config } from '../config.js';
import * as economyService from './economy.service.js';
import * as playerRepo from '../repositories/player.repository.js';
import { withTransaction } from '../repositories/transaction.repository.js';
import { broadcastUserStatusUpdate } from './live-updates.service.js';
import { logger } from '../logger.js';

const TICK_INTERVAL = config.gameloop.tickIntervalMs;

let tickCounter = 0;
let gameLoopActive = false;

/**
 * Fuehrt einen vollstaendigen Spiel-Tick ueber alle aktiven Benutzer aus.
 *
 * @returns {Promise<void>}
 * @sideEffects Aktualisiert Ressourcen/Bauqueue je User, sendet SSE-Statusupdates und schreibt Logs.
 */
export async function executeGameTick() {
    if (gameLoopActive) {
        logger.warn('[GAMELOOP] Tick already running, skipping current execution');
        return;
    }

    gameLoopActive = true;
    tickCounter++;
    const tickTime = new Date();
    const tickLogger = logger.child({ tickCounter, tickTime: tickTime.toISOString() });

    try {
        tickLogger.info('Tick started');

        const users = await playerRepo.findActiveIds();

        let processedCount = 0;

        for (const user of users) {
            try {
                const status = await withTransaction(async (client) => {
                    await economyService.applyProductionTicks(user.id, client);
                    await economyService.processFinishedQueue(user.id, client);
                    return economyService.getSpielerStatus(user.id, client);
                });

                broadcastUserStatusUpdate(user.id, status);
                processedCount++;
            } catch (err) {
                tickLogger.error(
                    {
                        userId: user.id,
                        err,
                    },
                    'Tick processing failed for user'
                );
            }
        }

        tickLogger.info({ processedCount, totalUsers: users.length }, 'Tick completed');
    } catch (error) {
        tickLogger.error({ err: error }, 'Critical tick failure');
    } finally {
        gameLoopActive = false;
    }
}

async function runTickSafely(errorPrefix) {
    try {
        await executeGameTick();
    } catch (err) {
        logger.error({ err }, errorPrefix);
    }
}

export function startGameLoop() {
    logger.info(
        {
            tickIntervalMs: TICK_INTERVAL,
            tickIntervalMinutes: (TICK_INTERVAL / 1000 / 60).toFixed(1),
        },
        'Game loop started'
    );
    void runTickSafely('Initiales Tick fehlgeschlagen');
    setInterval(async () => {
        await runTickSafely('Tick fehlgeschlagen');
    }, TICK_INTERVAL);
    logger.info('Game loop active');
}

export function getTickStats() {
    return {
        tickCounter,
        gameLoopActive,
        tickIntervalMs: TICK_INTERVAL,
        tickIntervalMinutes: (TICK_INTERVAL / 1000 / 60).toFixed(1),
    };
}
