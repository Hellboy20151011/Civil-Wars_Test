/**
 * Game Loop Scheduler - Zentrale Verwaltung des Tick-Systems
 * Delegiert an economy.service.js das eigentliche Handling.
 */

import { config } from '../config.js';
import * as economyService from './economy.service.js';
import * as playerRepo from '../repositories/player.repository.js';
import { withTransaction } from '../repositories/transaction.repository.js';
import { broadcastUserStatusUpdate } from './live-updates.service.js';

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
        console.log('[GAMELOOP] Tick lï¿½uft bereits, ï¿½berspringe...');
        return;
    }

    gameLoopActive = true;
    tickCounter++;
    const tickTime = new Date();

    try {
        console.log(`\n[TICK #${tickCounter}] Beginn um ${tickTime.toLocaleString('de-DE')}`);

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
                console.error(`[TICK] Fehler fï¿½r User ${user.id}:`, err.message);
            }
        }

        console.log(`  ? Spieler verarbeitet: ${processedCount}/${users.length}`);
        console.log(`[TICK #${tickCounter}] ? Abgeschlossen\n`);
    } catch (error) {
        console.error(`[TICK #${tickCounter}] ? Kritischer Fehler:`, error.message);
    } finally {
        gameLoopActive = false;
    }
}

async function runTickSafely(errorPrefix) {
    try {
        await executeGameTick();
    } catch (err) {
        console.error(`${errorPrefix}:`, err);
    }
}

export function startGameLoop() {
    console.log(
        `\n?? [GAMELOOP] Starte mit ${TICK_INTERVAL}ms Intervall (${(TICK_INTERVAL / 1000 / 60).toFixed(1)} min)`
    );
    void runTickSafely('Initiales Tick fehlgeschlagen');
    setInterval(async () => {
        await runTickSafely('Tick fehlgeschlagen');
    }, TICK_INTERVAL);
    console.log('?? [GAMELOOP] ? Aktiv\n');
}

export function getTickStats() {
    return {
        tickCounter,
        gameLoopActive,
        tickIntervalMs: TICK_INTERVAL,
        tickIntervalMinutes: (TICK_INTERVAL / 1000 / 60).toFixed(1),
    };
}
