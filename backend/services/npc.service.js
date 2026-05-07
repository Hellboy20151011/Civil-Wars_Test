/**
 * NPC Service – autonome KI-Spieler
 *
 * Typen:
 *   defensive  – baut Infrastruktur und Wirtschaft auf
 *   aggressive – baut zusätzlich Militär und greift Spieler an
 *
 * Wird einmal pro Gameloop-Tick für alle aktiven NPCs aufgerufen.
 */

import * as npcRepo from '../repositories/npc.repository.js';
import * as buildingRepo from '../repositories/building.repository.js';
import * as resourcesRepo from '../repositories/resources.repository.js';
import * as unitsRepo from '../repositories/units.repository.js';
import * as playerRepo from '../repositories/player.repository.js';
import * as buildingService from './buildings.service.js';
import * as unitsService from './units.service.js';
import * as combatService from './combat.service.js';
import { logger } from '../logger.js';

// Minimale Einheiten für einen Angriff (aggressive NPCs)
const MIN_ATTACK_UNITS = 5;
// Unterhalb dieser freien Energie kann kein geplanter NPC-Bau starten
// (kleinster Verbrauch in der Priorität: Wohnhaus mit 5).
const MIN_USEFUL_FREE_POWER = 5;

// Einkommensziele für Phase 2 – NPC baut Ressourcengebäude weiter bis diese
// Vorräte dauerhaft gehalten werden können.
const STEIN_TARGET     = 10_000;
const STAHL_TARGET     =  5_000;
const TREIBSTOFF_TARGET =  3_000;
// Pro Ölpumpe werden 5 Öl-Raffinerien benötigt (Verarbeitungsverhältnis).
const RAFFINERIEN_PRO_PUMPE = 5;

// Baupriorität: [ gebäudeTypName, condition-fn(status) | null ]
// condition-fn erhält { resources, buildingSummary, stromFrei } und gibt true zurück wenn gebaut werden soll
//
// Zwei Phasen:
//   Phase 1 – Je ein Exemplar jedes Ressourcengebäudes sicherstellen
//   Phase 2 – Weitere Exemplare bauen bis Einkommensziele erreicht sind

const DEFENSIVE_BUILD_PRIORITY = [
    // ── Phase 1: Einmalig je ein Exemplar jedes Ressourcengebäudes ─────────
    { name: 'Kraftwerk',             condition: (s) => s.stromFrei < MIN_USEFUL_FREE_POWER },
    { name: 'Wohnhaus',              condition: (s) => (s.buildingSummary['Wohnhaus'] ?? 0) < 1 },
    { name: 'Steinbruch',            condition: (s) => (s.buildingSummary['Steinbruch'] ?? 0) < 1 },
    { name: 'Stahlwerk',             condition: (s) => (s.buildingSummary['Stahlwerk'] ?? 0) < 1 },
    { name: 'Ölpumpe',               condition: (s) => (s.buildingSummary['Ölpumpe'] ?? 0) < 1 },
    { name: 'Öl-Raffinerie',         condition: (s) =>
        (s.buildingSummary['Ölpumpe'] ?? 0) >= 1 && (s.buildingSummary['Öl-Raffinerie'] ?? 0) < 1 },
    { name: 'Landverteidigung Level 1', condition: (s) =>
        (s.buildingSummary['Landverteidigung Level 1'] ?? 0) < 1 && s.resources.geld >= 120_000 },
    // ── Phase 2: Skalieren bis Einkommensziele ─────────────────────────────
    { name: 'Wohnhaus',         condition: (s) => s.resources.geld < 200_000 },
    { name: 'Steinbruch',       condition: (s) => s.resources.stein < STEIN_TARGET },
    { name: 'Stahlwerk',        condition: (s) => s.resources.stahl < STAHL_TARGET },
    { name: 'Ölpumpe',          condition: (s) => s.resources.treibstoff < TREIBSTOFF_TARGET },
    { name: 'Öl-Raffinerie',    condition: (s) =>
        (s.buildingSummary['Öl-Raffinerie'] ?? 0) < (s.buildingSummary['Ölpumpe'] ?? 0) * RAFFINERIEN_PRO_PUMPE },
    { name: 'Reihenhaus',       condition: (s) => s.resources.geld >= 200_000 },
    { name: 'Mehrfamilienhaus', condition: (s) => s.resources.geld >= 500_000 },
    { name: 'Hochhaus',         condition: null }, // immer wenn Ressourcen reichen
];

const AGGRESSIVE_BUILD_PRIORITY = [
    // ── Phase 1: Einmalig je ein Exemplar jedes Ressourcengebäudes ─────────
    { name: 'Kraftwerk',     condition: (s) => s.stromFrei < MIN_USEFUL_FREE_POWER },
    { name: 'Wohnhaus',      condition: (s) => (s.buildingSummary['Wohnhaus'] ?? 0) < 1 },
    { name: 'Steinbruch',    condition: (s) => (s.buildingSummary['Steinbruch'] ?? 0) < 1 },
    { name: 'Stahlwerk',     condition: (s) => (s.buildingSummary['Stahlwerk'] ?? 0) < 1 },
    { name: 'Ölpumpe',       condition: (s) => (s.buildingSummary['Ölpumpe'] ?? 0) < 1 },
    { name: 'Öl-Raffinerie', condition: (s) =>
        (s.buildingSummary['Ölpumpe'] ?? 0) >= 1 && (s.buildingSummary['Öl-Raffinerie'] ?? 0) < 1 },
    { name: 'Kaserne',       condition: (s) =>
        (s.buildingSummary['Ölpumpe'] ?? 0) >= 1 &&
        (s.buildingSummary['Öl-Raffinerie'] ?? 0) >= 1 &&
        (s.buildingSummary['Kaserne'] ?? 0) < 2 },
    // ── Phase 2: Skalieren bis Einkommensziele ─────────────────────────────
    { name: 'Wohnhaus',      condition: (s) => s.resources.geld < 150_000 },
    { name: 'Steinbruch',    condition: (s) => s.resources.stein < STEIN_TARGET },
    { name: 'Stahlwerk',     condition: (s) => s.resources.stahl < STAHL_TARGET },
    { name: 'Ölpumpe',       condition: (s) => s.resources.treibstoff < TREIBSTOFF_TARGET },
    { name: 'Öl-Raffinerie', condition: (s) =>
        (s.buildingSummary['Öl-Raffinerie'] ?? 0) < (s.buildingSummary['Ölpumpe'] ?? 0) * RAFFINERIEN_PRO_PUMPE },
    { name: 'Reihenhaus',    condition: (s) => s.resources.geld >= 200_000 },
];

// ─────────────────────────────────────────────────────────────────────────────
// Hilfsfunktionen
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sammelt den aktuellen Status eines NPCs.
 * Gibt null zurück wenn Ressourcen fehlen.
 */
async function _getNpcStatus(npcId) {
    const resources = await resourcesRepo.findByUserId(npcId);
    if (!resources) return null;

    // findBuildingsByUser liefert nur fertige Gebäude (is_constructing = FALSE)
    // findDetailedByUser liefert alle inkl. Baustellen
    const allBuildings = await buildingRepo.findDetailedByUser(npcId);
    const hasActiveConstruction = allBuildings.some((b) => b.is_constructing);

    const buildingSummary = {};
    for (const b of allBuildings.filter((b) => !b.is_constructing)) {
        buildingSummary[b.name] = (buildingSummary[b.name] ?? 0) + 1;
    }

    const powerSummary = await buildingRepo.findPowerSummaryByUser(npcId);
    const stromFrei = Number(powerSummary.production ?? 0) - Number(powerSummary.consumption ?? 0);

    return { resources, buildingSummary, stromFrei, hasActiveConstruction };
}

/**
 * Findet eine freie Position auf dem NPC-Baufeld.
 * Gibt einfach eine sequentielle Position zurück (Gebäude liegen auf einem 10×10-Grid).
 */
function _nextBuildLocation(buildings) {
    const used = new Set(buildings.map((b) => `${b.location_x},${b.location_y}`));
    for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 10; x++) {
            if (!used.has(`${x},${y}`)) return { x, y };
        }
    }
    // Fallback: zufällige Position außerhalb des Grids
    return { x: Math.floor(Math.random() * 50) + 10, y: Math.floor(Math.random() * 50) + 10 };
}

/**
 * Versucht, ein Gebäude zu bauen. Gibt true zurück wenn gestartet.
 *
 * Hinweis: NPCs nutzen bewusst den NPC-spezifischen Baupfad
 * `startBuildingConstruction(...)` (mit Koordinaten), damit die KI
 * Gebäude auf dem Raster platziert. Spieler nutzen `buildBuilding(...)`.
 */
async function _tryBuild(npcId, buildingName, buildings) {
    try {
        const buildingType = await buildingRepo.findTypeByName(buildingName);
        if (!buildingType) return false;

        const loc = _nextBuildLocation(buildings);
        await buildingService.startBuildingConstruction(npcId, buildingType.id, loc.x, loc.y);
        logger.info({ npcId, buildingName, loc }, '[NPC] Bau gestartet');
        return true;
    } catch {
        // Fehlschlag ist erwartet (z.B. Ressourcen knapp) – kein Error-Log nötig
        return false;
    }
}

/**
 * Versucht, 5 Infanteristen zu trainieren. Gibt true zurück wenn gestartet.
 */
async function _tryTrainInfantry(npcId) {
    try {
        const unitType = await unitsRepo.findTypeByName('Soldat');
        if (!unitType) return false;
        await unitsService.startTraining(npcId, unitType.id, 5);
        logger.info({ npcId }, '[NPC] Infanteristen ausgebildet');
        return true;
    } catch {
        return false;
    }
}

/**
 * Gibt den nächsten menschlichen (Non-NPC) Spieler zurück, der angreifbar ist.
 */
async function _findNearestHumanTarget(npc) {
    const humans = await playerRepo.findActiveHumanTargetsForMap(npc.id);
    if (humans.length === 0) return null;

    let nearest = null;
    let minDist = Infinity;
    for (const p of humans) {
        const dx = (npc.koordinate_x ?? 0) - p.koordinate_x;
        const dy = (npc.koordinate_y ?? 0) - p.koordinate_y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < minDist) {
            minDist = dist;
            nearest = p;
        }
    }
    return nearest;
}

/**
 * Versucht, den nächsten Spieler anzugreifen wenn genug Einheiten vorhanden.
 */
async function _tryAttack(npc) {
    try {
        const units = await unitsRepo.findDetailedByUser(npc.id);
        const attackers = units.filter(
            (u) => u.category !== 'defense' && !u.is_moving && Number(u.quantity) >= MIN_ATTACK_UNITS
        );
        if (attackers.length === 0) return;

        const target = await _findNearestHumanTarget(npc);
        if (!target) return;

        const attackUnits = attackers.slice(0, 2).map((u) => ({
            userUnitId: u.id,
            quantity: Math.min(Number(u.quantity), 10), // max 10 pro Einheitentyp pro Angriff
        }));

        await combatService.launchAttack(npc.id, target.id, attackUnits);
        logger.info({ npcId: npc.id, targetId: target.id }, '[NPC] Angriff gestartet');
    } catch {
        // Angriff nicht möglich (z.B. Limit erreicht, Treibstoff fehlt) – ignorieren
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Haupt-Tick-Funktion
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Führt einen KI-Entscheidungs-Tick für einen einzelnen NPC aus.
 *
 * @param {{ id: number, npc_type: string, koordinate_x: number, koordinate_y: number }} npc
 */
async function tickNpc(npc) {
    const status = await _getNpcStatus(npc.id);
    if (!status) return;

    const { hasActiveConstruction } = status;
    const buildings = await buildingRepo.findDetailedByUser(npc.id);

    // ── Bauentscheidung ────────────────────────────────────────────────────────
    if (!hasActiveConstruction) {
        const priority =
            npc.npc_type === 'aggressive' ? AGGRESSIVE_BUILD_PRIORITY : DEFENSIVE_BUILD_PRIORITY;

        for (const entry of priority) {
            const conditionMet = entry.condition == null || entry.condition(status);
            if (!conditionMet) continue;

            const built = await _tryBuild(npc.id, entry.name, buildings);
            if (built) break; // pro Tick nur ein Bau
        }
    }

    // ── Militär & Angriff (nur aggressive) ────────────────────────────────────
    if (npc.npc_type === 'aggressive') {
        await _tryTrainInfantry(npc.id);
        await _tryAttack(npc);
    }
}

/**
 * Führt Ticks für alle aktiven NPCs aus.
 * Wird vom Gameloop-Scheduler nach dem regulären Spieler-Tick aufgerufen.
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
