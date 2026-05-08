/**
 * NPC Status
 *
 * Lädt den aktuellen Zustand eines NPCs aus der Datenbank und berechnet
 * daraus alle Werte die für die KI-Entscheidungen benötigt werden.
 */

import * as buildingRepo from '../../repositories/building.repository.js';
import * as resourcesRepo from '../../repositories/resources.repository.js';
import {
    STEIN_PER_STEINBRUCH,
    STAHL_PER_STAHLWERK,
    TREIBSTOFF_PER_RAFFINERIE,
} from './npc.config.js';

/**
 * Sammelt den aktuellen Status eines NPCs.
 * Gibt null zurück wenn keine Ressourcen gefunden werden (z.B. NPC noch nicht initialisiert).
 *
 * @param {number} npcId
 * @returns {Promise<object|null>} Status-Objekt mit folgenden Feldern:
 *   - resources           – { geld, stein, stahl, treibstoff }
 *   - buildingSummary     – { [gebäudeName]: anzahl } (nur fertige Gebäude)
 *   - stromFrei           – freie Energiekapazität in Mwh
 *   - hasActiveConstruction – ob gerade ein Gebäude im Bau ist
 *   - steinProduction     – t Stein die der NPC pro Tick produziert
 *   - stahlProduction     – t Stahl die der NPC pro Tick produziert
 *   - treibstoffProduction – L Treibstoff die der NPC pro Tick produziert
 */
export async function getNpcStatus(npcId) {
    const resources = await resourcesRepo.findByUserId(npcId);
    if (!resources) return null;

    // findDetailedByUser liefert alle Gebäude inkl. Baustellen (is_constructing = true/false)
    const allBuildings = await buildingRepo.findDetailedByUser(npcId);
    const hasActiveConstruction = allBuildings.some((b) => b.is_constructing);

    // buildingSummary zählt nur fertige Gebäude
    const buildingSummary = {};
    for (const b of allBuildings.filter((b) => !b.is_constructing)) {
        buildingSummary[b.name] = (buildingSummary[b.name] ?? 0) + 1;
    }

    const powerSummary = await buildingRepo.findPowerSummaryByUser(npcId);
    const stromFrei = Number(powerSummary.production ?? 0) - Number(powerSummary.consumption ?? 0);

    // Produktionsraten aus den fertigen Gebäuden berechnen
    const steinProduction      = (buildingSummary['Steinbruch']    ?? 0) * STEIN_PER_STEINBRUCH;
    const stahlProduction      = (buildingSummary['Stahlwerk']     ?? 0) * STAHL_PER_STAHLWERK;
    const treibstoffProduction = (buildingSummary['Öl-Raffinerie'] ?? 0) * TREIBSTOFF_PER_RAFFINERIE;

    return {
        resources,
        buildingSummary,
        stromFrei,
        hasActiveConstruction,
        steinProduction,
        stahlProduction,
        treibstoffProduction,
    };
}
