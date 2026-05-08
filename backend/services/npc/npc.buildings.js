/**
 * NPC Gebäudebau
 *
 * Enthält:
 *  – Baupriorität für defensive und aggressive NPCs (zwei Phasen)
 *  – Hilfsfunktion zum Finden einer freien Baustelle
 *  – Funktion zum Starten eines Gebäudebaus
 */

import * as buildingRepo from '../../repositories/building.repository.js';
import * as buildingService from '../buildings.service.js';
import { logger } from '../../logger.js';
import {
    MIN_USEFUL_FREE_POWER,
    STEIN_PRODUCTION_TARGET,
    STAHL_PRODUCTION_TARGET,
    TREIBSTOFF_PRODUCTION_TARGET,
    RAFFINERIEN_PRO_PUMPE,
} from './npc.config.js';

// ─────────────────────────────────────────────────────────────────────────────
// Baupriorität-Listen
//
// Jeder Eintrag hat:
//   name      – exakter Gebäudetyp-Name aus der Datenbank
//   condition – Funktion die den NPC-Status prüft und true zurückgibt wenn
//               dieses Gebäude als nächstes gebaut werden soll
//               (null = immer bauen wenn Ressourcen reichen)
//
// Zwei Phasen:
//   Phase 1 – Je ein Exemplar jedes Ressourcengebäudes sicherstellen
//   Phase 2 – Weitere Exemplare bauen bis Produktionsziele erreicht sind
// ─────────────────────────────────────────────────────────────────────────────

export const DEFENSIVE_BUILD_PRIORITY = [
    // ── Phase 1: je ein Exemplar ──────────────────────────────────────────────
    { name: 'Kraftwerk',             condition: (s) => s.stromFrei < MIN_USEFUL_FREE_POWER },
    { name: 'Wohnhaus',              condition: (s) => (s.buildingSummary['Wohnhaus']   ?? 0) < 1 },
    { name: 'Steinbruch',            condition: (s) => (s.buildingSummary['Steinbruch'] ?? 0) < 1 },
    { name: 'Stahlwerk',             condition: (s) => (s.buildingSummary['Stahlwerk']  ?? 0) < 1 },
    { name: 'Ölpumpe',               condition: (s) => (s.buildingSummary['Ölpumpe']   ?? 0) < 1 },
    { name: 'Öl-Raffinerie',         condition: (s) =>
        (s.buildingSummary['Ölpumpe'] ?? 0) >= 1 && (s.buildingSummary['Öl-Raffinerie'] ?? 0) < 1 },
    { name: 'Landverteidigung Level 1', condition: (s) =>
        (s.buildingSummary['Landverteidigung Level 1'] ?? 0) < 1 && s.resources.geld >= 120_000 },

    // ── Phase 2: skalieren bis Produktionsziele ───────────────────────────────
    { name: 'Wohnhaus',         condition: (s) => s.resources.geld < 200_000 },
    { name: 'Steinbruch',       condition: (s) => s.steinProduction < STEIN_PRODUCTION_TARGET },
    { name: 'Stahlwerk',        condition: (s) => s.stahlProduction < STAHL_PRODUCTION_TARGET },
    // Öl-Raffinerie zuerst (vorhandene Kapazität füllen), dann Ölpumpe (Kapazität erweitern)
    { name: 'Öl-Raffinerie',    condition: (s) =>
        s.treibstoffProduction < TREIBSTOFF_PRODUCTION_TARGET &&
        (s.buildingSummary['Öl-Raffinerie'] ?? 0) < (s.buildingSummary['Ölpumpe'] ?? 0) * RAFFINERIEN_PRO_PUMPE },
    { name: 'Ölpumpe',          condition: (s) => s.treibstoffProduction < TREIBSTOFF_PRODUCTION_TARGET },
    { name: 'Reihenhaus',       condition: (s) => s.resources.geld >= 200_000 },
    { name: 'Mehrfamilienhaus', condition: (s) => s.resources.geld >= 500_000 },
    { name: 'Hochhaus',         condition: null }, // immer wenn Ressourcen reichen
];

export const AGGRESSIVE_BUILD_PRIORITY = [
    // ── Phase 1: je ein Exemplar ──────────────────────────────────────────────
    { name: 'Kraftwerk',     condition: (s) => s.stromFrei < MIN_USEFUL_FREE_POWER },
    { name: 'Wohnhaus',      condition: (s) => (s.buildingSummary['Wohnhaus']   ?? 0) < 1 },
    { name: 'Steinbruch',    condition: (s) => (s.buildingSummary['Steinbruch'] ?? 0) < 1 },
    { name: 'Stahlwerk',     condition: (s) => (s.buildingSummary['Stahlwerk']  ?? 0) < 1 },
    { name: 'Ölpumpe',       condition: (s) => (s.buildingSummary['Ölpumpe']   ?? 0) < 1 },
    { name: 'Öl-Raffinerie', condition: (s) =>
        (s.buildingSummary['Ölpumpe'] ?? 0) >= 1 && (s.buildingSummary['Öl-Raffinerie'] ?? 0) < 1 },
    { name: 'Kaserne Level 1', condition: (s) =>
        (s.buildingSummary['Ölpumpe']       ?? 0) >= 1 &&
        (s.buildingSummary['Öl-Raffinerie'] ?? 0) >= 1 &&
        (s.buildingSummary['Kaserne Level 1'] ?? 0) < 1 },

    // ── Phase 2: skalieren bis Produktionsziele ───────────────────────────────
    { name: 'Wohnhaus',      condition: (s) => s.resources.geld < 150_000 },
    { name: 'Steinbruch',    condition: (s) => s.steinProduction < STEIN_PRODUCTION_TARGET },
    { name: 'Stahlwerk',     condition: (s) => s.stahlProduction < STAHL_PRODUCTION_TARGET },
    // Öl-Raffinerie zuerst (vorhandene Kapazität füllen), dann Ölpumpe (Kapazität erweitern)
    { name: 'Öl-Raffinerie', condition: (s) =>
        s.treibstoffProduction < TREIBSTOFF_PRODUCTION_TARGET &&
        (s.buildingSummary['Öl-Raffinerie'] ?? 0) < (s.buildingSummary['Ölpumpe'] ?? 0) * RAFFINERIEN_PRO_PUMPE },
    { name: 'Ölpumpe',       condition: (s) => s.treibstoffProduction < TREIBSTOFF_PRODUCTION_TARGET },
    { name: 'Reihenhaus',    condition: (s) => s.resources.geld >= 200_000 },
];

// ─────────────────────────────────────────────────────────────────────────────
// Hilfsfunktionen
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Findet die nächste freie Position auf dem 10×10-Baufeld des NPCs.
 * @param {{ location_x: number, location_y: number }[]} buildings – alle vorhandenen Gebäude
 * @returns {{ x: number, y: number }}
 */
export function nextBuildLocation(buildings) {
    const used = new Set(buildings.map((b) => `${b.location_x},${b.location_y}`));
    for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 10; x++) {
            if (!used.has(`${x},${y}`)) return { x, y };
        }
    }
    // Fallback wenn das 10×10-Grid voll ist
    return { x: Math.floor(Math.random() * 50) + 10, y: Math.floor(Math.random() * 50) + 10 };
}

/**
 * Startet den Bau eines Gebäudes für einen NPC.
 * Gibt true zurück wenn der Bau erfolgreich gestartet wurde, sonst false.
 *
 * Hinweis: NPCs nutzen `startBuildingConstruction` (mit Koordinaten) statt
 * `buildBuilding`, damit Gebäude auf dem NPC-Raster platziert werden.
 *
 * @param {number} npcId
 * @param {string} buildingName – exakter Name aus building_types
 * @param {{ location_x: number, location_y: number }[]} buildings – vorhandene Gebäude
 */
export async function tryBuild(npcId, buildingName, buildings) {
    try {
        const buildingType = await buildingRepo.findTypeByName(buildingName);
        if (!buildingType) return false;

        const loc = nextBuildLocation(buildings);
        await buildingService.startBuildingConstruction(npcId, buildingType.id, loc.x, loc.y);
        logger.info({ npcId, buildingName, loc }, '[NPC] Bau gestartet');
        return true;
    } catch {
        // Fehlschlag ist erwartet (z.B. Ressourcen knapp) – kein Error-Log nötig
        return false;
    }
}
