import { config } from '../config.js';

/**
 * Euklidische Distanz zwischen zwei Koordinaten (in Gittereinheiten).
 * @param {number} x1
 * @param {number} y1
 * @param {number} x2
 * @param {number} y2
 * @returns {number}
 */
export function calcDistance(x1, y1, x2, y2) {
    return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
}

/**
 * Ankunftszeit aus Distanz und Geschwindigkeit berechnen.
 * Formel: travelTicks = distance / speed  → ms = travelTicks * tickIntervalMs
 * @param {number} distance
 * @param {number} speed – Felder pro Tick
 * @returns {Date}
 */
export function calcArrivalTime(distance, speed) {
    const travelTicks = distance / speed;
    const tickMs = config.gameloop.tickIntervalMs;
    return new Date(Date.now() + travelTicks * tickMs);
}
