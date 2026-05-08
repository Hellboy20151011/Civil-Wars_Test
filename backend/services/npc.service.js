/**
 * NPC Service – Einstiegspunkt der autonomen KI
 *
 * Dieser Orchestrator koordiniert die drei NPC-Teilsysteme:
 *   1. Gebäudebau  → services/npc/npc.buildings.js
 *   2. Einheiten   → services/npc/npc.units.js
 *   3. Kampf       → services/npc/npc.combat.js
 *
 * Die Spielkonstanten stehen in:  services/npc/npc.config.js
 * Der Status-Loader steht in:     services/npc/npc.status.js
 *
 * Public API (unverändert für gameloop-scheduler und Tests):
 *   tickAllNpcs()                   – führt einen KI-Tick für alle aktiven NPCs aus
 *   getNpcDebugSummary()            – gibt eine Debug-Zusammenfassung aller NPCs zurück
 *   _resetAttackCooldownsForTests() – setzt den Angriffs-Cooldown zurück (nur für Tests)
 */

import * as npcRepo from '../repositories/npc.repository.js';
import * as buildingRepo from '../repositories/building.repository.js';
import { logger } from '../logger.js';

import { getNpcStatus }                                                  from './npc/npc.status.js';
import { DEFENSIVE_BUILD_PRIORITY, AGGRESSIVE_BUILD_PRIORITY, tryBuild } from './npc/npc.buildings.js';
import { tryTrainInfantry }                                              from './npc/npc.units.js';
import { tryAttack, resetAttackCooldownsForTests }                       from './npc/npc.combat.js';

// Re-export für Tests – der Testpfad bleibt rückwärtskompatibel
export { resetAttackCooldownsForTests as _resetAttackCooldownsForTests };

// ─────────────────────────────────────────────────────────────────────────────
// KI-Tick für einen einzelnen NPC
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Führt einen KI-Entscheidungs-Tick für einen NPC aus.
 *
 * Ablauf pro Tick:
 *   1. Status laden (Ressourcen, Gebäude, Strom, Produktionsraten)
 *   2. Wenn kein Bau läuft: nächstes Gebäude aus der Prioritätsliste starten
 *   3. Bei aggressiven NPCs: Infanterie trainieren + Angriff versuchen
 *
 * @param {{ id: number, npc_type: string, koordinate_x: number, koordinate_y: number }} npc
 */
async function tickNpc(npc) {
    const status = await getNpcStatus(npc.id);
    if (!status) return;

    const { hasActiveConstruction } = status;

    // ── Gebäudebau ────────────────────────────────────────────────────────────
    // Pro Tick wird höchstens ein Gebäude gestartet.
    // Ist bereits ein Bau aktiv, wird übersprungen (NPCs haben keine Warteschlange).
    if (!hasActiveConstruction) {
        const priority = npc.npc_type === 'aggressive'
            ? AGGRESSIVE_BUILD_PRIORITY
            : DEFENSIVE_BUILD_PRIORITY;

        // Alle Gebäude (inkl. Baustellen) für die Positionsberechnung laden
        const allBuildings = await buildingRepo.findDetailedByUser(npc.id);

        for (const entry of priority) {
            const conditionMet = entry.condition === null || entry.condition(status);
            if (conditionMet) {
                const started = await tryBuild(npc.id, entry.name, allBuildings);
                if (started) break; // Nur ein Bau pro Tick
            }
        }
    }

    // ── Militär & Angriff (nur aggressive) ───────────────────────────────────
    if (npc.npc_type === 'aggressive') {
        await tryTrainInfantry(npc.id);
        await tryAttack(npc, status);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Führt Ticks für alle aktiven NPCs aus.
 * Wird vom Gameloop-Scheduler nach dem regulären Spieler-Tick aufgerufen.
 * Ein fehlschlagender Einzel-Tick unterbricht nicht die anderen NPCs.
 */
export async function tickAllNpcs() {
    const npcs = await npcRepo.findActiveNpcs();
    if (npcs.length === 0) return;

    for (const npc of npcs) {
        try {
            await tickNpc(npc);
        } catch (err) {
            logger.error({ npcId: npc.id, err }, '[NPC] Tick fehlgeschlagen');
        }
    }

    logger.debug({ count: npcs.length }, '[NPC] Alle NPC-Ticks abgeschlossen');
}

export async function getNpcDebugSummary() {
    return npcRepo.findNpcDebugSummary();
}