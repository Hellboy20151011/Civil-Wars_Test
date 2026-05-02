/**
 * Game Loop Scheduler - Zentrale Verwaltung des Tick-Systems
 * Delegiert an economy.service.js das eigentliche Handling.
 */

import pool from '../database/db.js';
import * as economyService from '../services/economy.service.js';

const TICK_INTERVAL = Number(process.env.TICK_INTERVAL_MS) ||
    (process.env.NODE_ENV === 'production' ? 600000 : 60000);

let tickCounter = 0;
let gameLoopActive = false;

export async function executeGameTick() {
    if (gameLoopActive) {
        console.log('[GAMELOOP] Tick l�uft bereits, �berspringe...');
        return;
    }

    gameLoopActive = true;
    tickCounter++;
    const tickTime = new Date();

    try {
        console.log(`\n[TICK #${tickCounter}] Beginn um ${tickTime.toLocaleString('de-DE')}`);

        const usersResult = await pool.query('SELECT id FROM users WHERE is_active = TRUE');
        const users = usersResult.rows;

        let processedCount = 0;

        for (const user of users) {
            const client = await pool.connect();
            try {
                await client.query('BEGIN');
                await economyService.applyProductionTicks(user.id, client);
                await economyService.processFinishedQueue(user.id, client);
                await client.query('COMMIT');
                processedCount++;
            } catch (err) {
                await client.query('ROLLBACK');
                console.error(`[TICK] Fehler f�r User ${user.id}:`, err.message);
            } finally {
                client.release();
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

export function startGameLoop() {
    console.log(`\n?? [GAMELOOP] Starte mit ${TICK_INTERVAL}ms Intervall (${(TICK_INTERVAL / 1000 / 60).toFixed(1)} min)`);
    executeGameTick().catch(err => console.error('Initiales Tick fehlgeschlagen:', err));
    setInterval(() => {
        executeGameTick().catch(err => console.error('Tick fehlgeschlagen:', err));
    }, TICK_INTERVAL);
    console.log('?? [GAMELOOP] ? Aktiv\n');
}

export function getTickStats() {
    return {
        tickCounter,
        gameLoopActive,
        tickIntervalMs: TICK_INTERVAL,
        tickIntervalMinutes: (TICK_INTERVAL / 1000 / 60).toFixed(1)
    };
}
