/**
 * NPC Kampf
 *
 * Zuständig für:
 *  – Prüfung ob die Wirtschaft des NPCs stark genug für Angriffe ist
 *  – Auswahl und Sortierung menschlicher Angriffsziele
 *  – Starten von Angriffen (inkl. 12h-Cooldown)
 */

import * as unitsRepo from '../../repositories/units.repository.js';
import * as playerRepo from '../../repositories/player.repository.js';
import * as combatService from '../combat.service.js';
import { logger } from '../../logger.js';
import {
    MIN_ATTACK_UNITS,
    MAX_ATTACK_RATIO,
    NPC_ATTACK_COOLDOWN_MS,
    STEIN_PRODUCTION_TARGET,
    STAHL_PRODUCTION_TARGET,
    TREIBSTOFF_PRODUCTION_TARGET,
} from './npc.config.js';

// ─────────────────────────────────────────────────────────────────────────────
// Angriffs-Cooldown
// In-Memory-Tracking wann ein NPC zuletzt angegriffen hat.
// Wird beim Server-Neustart zurückgesetzt – das ist gewollt.
// ─────────────────────────────────────────────────────────────────────────────

const _lastAttackAt = new Map();

/** Nur für Tests: Cooldown-Tracking zurücksetzen. */
export function resetAttackCooldownsForTests() {
    _lastAttackAt.clear();
}

// ─────────────────────────────────────────────────────────────────────────────
// Hilfsfunktionen
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Prüft ob der NPC mindestens 50 % seiner Produktionsziele erreicht hat
 * UND alle vier Grundproduktionsgebäude mindestens einmal vorhanden sind.
 *
 * Erst wenn diese Bedingung erfüllt ist werden Angriffe freigegeben –
 * der NPC soll zuerst eine stabile Wirtschaft aufbauen.
 *
 * @param {object} status – Rückgabe von _getNpcStatus
 */
export function hasMinProductionReady(status) {
    const { buildingSummary, steinProduction, stahlProduction, treibstoffProduction } = status;
    return (
        (buildingSummary['Steinbruch']    ?? 0) >= 1 &&
        (buildingSummary['Stahlwerk']     ?? 0) >= 1 &&
        (buildingSummary['Ölpumpe']       ?? 0) >= 1 &&
        (buildingSummary['Öl-Raffinerie'] ?? 0) >= 1 &&
        steinProduction      >= STEIN_PRODUCTION_TARGET      * 0.5 &&
        stahlProduction      >= STAHL_PRODUCTION_TARGET      * 0.5 &&
        treibstoffProduction >= TREIBSTOFF_PRODUCTION_TARGET * 0.5
    );
}

/**
 * Gibt alle aktiven menschlichen Spieler sortiert nach Distanz zum NPC zurück.
 * Der nächste Spieler steht vorne in der Liste.
 *
 * @param {{ id: number, koordinate_x: number, koordinate_y: number }} npc
 */
async function getSortedHumanTargets(npc) {
    const humans = await playerRepo.findActiveHumanTargetsForMap(npc.id);
    return humans
        .map((p) => {
            const dx = (npc.koordinate_x ?? 0) - p.koordinate_x;
            const dy = (npc.koordinate_y ?? 0) - p.koordinate_y;
            return { player: p, dist: Math.sqrt(dx * dx + dy * dy) };
        })
        .sort((a, b) => a.dist - b.dist)
        .map((e) => e.player);
}

// ─────────────────────────────────────────────────────────────────────────────
// Hauptfunktion
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Versucht alle erreichbaren menschlichen Spieler gleichzeitig anzugreifen.
 * Einheiten werden der Reihe nach auf Ziele (nächste zuerst) verteilt.
 *
 * Voraussetzungen:
 *   1. Produktionsminimum muss erfüllt sein (hasMinProductionReady)
 *   2. Cooldown seit letztem Angriff muss abgelaufen sein
 *
 * @param {{ id: number, koordinate_x: number, koordinate_y: number }} npc
 * @param {object} status – Rückgabe von _getNpcStatus
 */
export async function tryAttack(npc, status) {
    // 1. Wirtschaft stabil genug?
    if (!hasMinProductionReady(status)) return;

    // 2. Cooldown abgelaufen?
    const now = Date.now();
    const lastAttack = _lastAttackAt.get(npc.id) ?? 0;
    if (now - lastAttack < NPC_ATTACK_COOLDOWN_MS) return;

    try {
        const units = await unitsRepo.findDetailedByUser(npc.id);

        // Einheitentypen die nicht unterwegs sind und genug Menge haben
        const availableAttackers = units.filter(
            (u) => u.category !== 'defense' && !u.is_moving && Number(u.quantity) >= MIN_ATTACK_UNITS
        );
        if (availableAttackers.length === 0) return;

        const targets = await getSortedHumanTargets(npc);
        if (targets.length === 0) return;

        // Restmengen für diese Runde verfolgen (damit kein Überlaufen entsteht)
        const remaining = new Map(availableAttackers.map((u) => [u.id, Number(u.quantity)]));
        let anyLaunched = false;

        for (const target of targets) {
            // Ersten Einheitentyp mit noch ausreichender Menge wählen
            const attacker = availableAttackers.find(
                (u) => (remaining.get(u.id) ?? 0) >= MIN_ATTACK_UNITS
            );
            if (!attacker) break; // Keine Einheiten mehr für weitere Ziele

            const qty = Math.max(
                MIN_ATTACK_UNITS,
                Math.floor((remaining.get(attacker.id) ?? 0) * MAX_ATTACK_RATIO)
            );

            try {
                await combatService.launchAttack(npc.id, target.id, [
                    { userUnitId: attacker.id, quantity: qty },
                ]);
                remaining.set(attacker.id, (remaining.get(attacker.id) ?? 0) - qty);
                anyLaunched = true;
                logger.info({ npcId: npc.id, targetId: target.id, qty }, '[NPC] Angriff gestartet');
            } catch {
                // Einzelner Angriff fehlgeschlagen (Treibstoff, Limit, etc.) – weiter mit nächstem Ziel
            }
        }

        if (anyLaunched) {
            _lastAttackAt.set(npc.id, now);
        }
    } catch {
        // Gesamtfehler – ignorieren damit andere NPCs weiterlaufen
    }
}
