/**
 * Combat Service – distanzbasierte Kampf-Missionen zwischen Spielern
 *
 * Ablauf:
 *   1. launchAttack()        – Spieler entsendet Einheiten → Mission wird angelegt, Einheiten reserviert
 *   2. processArrivingMissions()  – Tick-System: Einheiten kommen an → Kampf wird berechnet,
 *                                   Verluste gespeichert, Rückreise gestartet
 *   3. processReturningMissions() – Tick-System: Einheiten sind zurück → Mengen angepasst, Mission abgeschlossen
 */

import * as buildingRepo from '../repositories/building.repository.js';
import * as combatMissionsRepo from '../repositories/combat-missions.repository.js';
import * as playerRepo from '../repositories/player.repository.js';
import * as unitsRepo from '../repositories/units.repository.js';
import { withTransaction } from '../repositories/transaction.repository.js';
import { broadcastToUser } from './live-updates.service.js';
import { logger } from '../logger.js';
import { createServiceError } from './service-error.js';
import { createRequire } from 'module';
import { calcDistance, calcArrivalTime } from '../utils/game-math.js';

const require = createRequire(import.meta.url);
const MATCHUPS = require('../data/combat-matchups.json');

// ─────────────────────────────────────────────────────────────────────────────
// PLÜNDERUNGS-LOGIK
// ─────────────────────────────────────────────────────────────────────────────

const PLUNDER_RATE = 0.25; // 25 % der Gebäude werden zerstört/geplündert

// Pro Ölpumpe dürfen maximal 5 Öl-Raffinerien betrieben werden
const MAX_RAFFINERIEN_PER_PUMPE = 5;

/**
 * Zerstört einen Teil der Unterkunfts- und Ressourcenproduktionsgebäude des Verteidigers.
 * Regeln:
 *   - Nur Gebäude der Kategorie 'housing' und 'infrastructure' mit Produktion/Verbrauch
 *   - Mindestens 1 Gebäude jedes Typs bleibt erhalten
 *   - Ölpumpe/Öl-Raffinerie-Verhältnis: max. 5 Raffinerien pro Pumpe nach Plünderung
 *   - Kraftwerke werden zuletzt entfernt, um kein Stromdefizit beim Verteidiger auszulösen
 *
 * @param {number} defenderId
 * @param {import('pg').PoolClient} client
 * @returns {Promise<Array<{ name: string, removed: number, remaining: number }>>}
 */
async function _plunderBuildings(defenderId, client) {
    const buildings = await buildingRepo.findBuildingsByUser(defenderId, client);

    // Plünderable Gebäude: housing + infrastructure mit Ressourcenproduktion oder -verbrauch
    const plunderable = buildings.filter(
        (b) =>
            b.category === 'housing' ||
            (b.category === 'infrastructure' &&
                (Number(b.power_production) > 0 ||
                    Number(b.power_consumption) > 0 ||
                    Number(b.stone_production) > 0 ||
                    Number(b.steel_production) > 0 ||
                    Number(b.fuel_production) > 0 ||
                    Number(b.money_production) > 0))
    );

    // ── Schritt 1: Entfernungsplan erstellen (ohne Kraftwerke) ────────────────
    // Map: building.id → { b, toRemove }
    const plan = new Map();
    for (const b of plunderable.filter((b) => Number(b.power_production) <= 0)) {
        const count = Number(b.anzahl);
        const toRemove = Math.min(Math.floor(count * PLUNDER_RATE), count - 1);
        plan.set(b.id, { b, toRemove });
    }

    // ── Schritt 2: Ölpumpe / Öl-Raffinerie Gleichgewicht sicherstellen ───────
    // Constraint nach Plünderung: raffinerien_remaining <= pumpen_remaining * MAX_RAFFINERIEN_PER_PUMPE
    const pumpenEntry = buildings.find((b) => b.name === 'Ölpumpe');
    const raffinerieEntry = buildings.find((b) => b.name === 'Öl-Raffinerie');
    if (pumpenEntry && raffinerieEntry) {
        const pumpenCount = Number(pumpenEntry.anzahl);
        const raffinerieCount = Number(raffinerieEntry.anzahl);
        const pumpenRemoval = plan.get(pumpenEntry.id)?.toRemove ?? 0;
        const raffinerieRemoval = plan.get(raffinerieEntry.id)?.toRemove ?? 0;

        const pumpenAfter = pumpenCount - pumpenRemoval;
        const raffinerieAfter = raffinerieCount - raffinerieRemoval;
        const maxRaffinerien = pumpenAfter * MAX_RAFFINERIEN_PER_PUMPE;

        if (raffinerieAfter > maxRaffinerien) {
            // Zusätzliche Raffinerien entfernen, aber mindestens 1 behalten
            const newRaffinerieAfter = Math.max(1, maxRaffinerien);
            const newRaffinerieRemoval = raffinerieCount - newRaffinerieAfter;
            plan.set(raffinerieEntry.id, { b: raffinerieEntry, toRemove: newRaffinerieRemoval });
        }
    }

    // ── Schritt 3: Nicht-Kraftwerk-Gebäude entfernen ──────────────────────────
    const plunderLog = [];
    for (const { b, toRemove } of plan.values()) {
        if (toRemove <= 0) continue;
        await buildingRepo.removeUserBuildingsByType(defenderId, b.id, toRemove, client);
        plunderLog.push({ name: b.name, removed: toRemove, remaining: Number(b.anzahl) - toRemove });
    }

    // ── Schritt 4: Kraftwerke – Strom-Sicherheitscheck ───────────────────────
    // Aktuell nach obigen Entfernungen lesen (Verbrauch ist gesunken)
    for (const b of plunderable.filter((b) => Number(b.power_production) > 0)) {
        const count = Number(b.anzahl);
        let toRemove = Math.min(Math.floor(count * PLUNDER_RATE), count - 1);
        if (toRemove <= 0) continue;

        const { production, consumption } = await buildingRepo.findPowerSummaryByUser(defenderId, client);
        const powerPerUnit = Number(b.power_production);
        // Maximal entfernbar ohne Defizit: floor((prod - cons) / powerPerUnit)
        const maxRemovable = Math.floor((Number(production) - Number(consumption)) / powerPerUnit);
        toRemove = Math.min(toRemove, Math.max(0, maxRemovable), count - 1);
        if (toRemove <= 0) continue;

        await buildingRepo.removeUserBuildingsByType(defenderId, b.id, toRemove, client);
        plunderLog.push({ name: b.name, removed: toRemove, remaining: count - toRemove });
    }

    return plunderLog;
}

// ─────────────────────────────────────────────────────────────────────────────
// KAMPF-MATCHUP-TABELLE  (unit-vs-unit aus combat-matchups.json)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Gibt den Einheit-vs-Einheit-Multiplikator zurück.
 * Quelle: backend/data/combat-matchups.json
 * @param {string} attackerName  – unit_name des Angreifers
 * @param {string} defenderName  – unit_name des Verteidigers
 * @returns {number} 0 = Angriff nicht möglich ("x" oder unbekannte Kombination)
 */
function getUnitMatchup(attackerName, defenderName) {
    const val = MATCHUPS[attackerName]?.[defenderName];
    if (!val || val === 'x') return 0;
    return parseFloat(val.replace(',', '.'));
}

// ─────────────────────────────────────────────────────────────────────────────
// HILFSFUNKTIONEN
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Langsamste Einheit einer Liste bestimmt die Bewegungsgeschwindigkeit des Verbands.
 * @param {Array<{ movement_speed: number }>} unitTypes
 * @returns {number} Felder pro Tick
 */
function slowestSpeed(unitTypes) {
    return Math.min(...unitTypes.map((u) => Number(u.movement_speed)));
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. ANGRIFF STARTEN
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Startet einen Angriff auf einen anderen Spieler.
 *
 * @param {number} attackerId  – ID des angreifenden Spielers
 * @param {number} defenderId  – ID des angegriffenen Spielers
 * @param {Array<{ userUnitId: number, quantity: number }>} units
 *   Liste der eingesetzten Einheiten mit Teilmenge (quantity darf nicht > Vorrat sein)
 * @returns {Promise<{ missionId: number, distance: number, arrivalTime: Date }>}
 */
export async function launchAttack(attackerId, defenderId, units) {
    if (!units || units.length === 0) throw createServiceError('Mindestens eine Einheit erforderlich', 400, 'NO_UNITS');
    if (attackerId === defenderId) throw createServiceError('Angriff auf sich selbst nicht möglich', 400, 'SELF_ATTACK');

    return withTransaction(async (client) => {
        // Koordinaten beider Spieler laden
        const [attacker, defender] = await Promise.all([
            playerRepo.findById(attackerId, client),
            playerRepo.findById(defenderId, client),
        ]);

        if (!attacker) throw createServiceError('Angreifer nicht gefunden', 404, 'ATTACKER_NOT_FOUND');
        if (!defender) throw createServiceError('Verteidiger nicht gefunden', 404, 'DEFENDER_NOT_FOUND');
        if (attacker.koordinate_x == null || defender.koordinate_x == null) {
            throw createServiceError('Spielerkoordinaten fehlen', 400, 'MISSING_COORDINATES');
        }

        // Einheiten validieren + Daten laden
        const unitRecords = [];
        for (const entry of units) {
            const userUnitId = entry.userUnitId ?? entry.user_unit_id;
            const unit = await unitsRepo.findMovableUnit(userUnitId, attackerId, client);
            if (!unit) throw createServiceError(`Einheit ${userUnitId} nicht gefunden oder gehört nicht dir`, 404, 'UNIT_NOT_FOUND');
            if (unit.is_moving) throw createServiceError(`Einheit ${unit.id} ist bereits unterwegs`, 409, 'UNIT_BUSY');
            if (unit.quantity < entry.quantity) {
                throw createServiceError(`Nicht genug Einheiten (vorhanden: ${unit.quantity}, gefordert: ${entry.quantity})`, 400, 'INSUFFICIENT_UNITS');
            }
            unitRecords.push({ ...unit, quantitySent: entry.quantity });
        }

        // Geschwindigkeit = langsamste Einheit
        const speed = slowestSpeed(unitRecords);
        const distance = calcDistance(
            attacker.koordinate_x, attacker.koordinate_y,
            defender.koordinate_x, defender.koordinate_y
        );
        if (distance === 0) throw createServiceError('Ziel ist identisch mit eigener Position', 400, 'SAME_POSITION');
        const arrivalTime = calcArrivalTime(distance, speed);

        // Mission anlegen
        const mission = await combatMissionsRepo.createMission(
            attackerId,
            defenderId,
            attacker.koordinate_x, attacker.koordinate_y,
            defender.koordinate_x, defender.koordinate_y,
            distance,
            arrivalTime,
            client
        );

        // Einheiten der Mission zuordnen + aus dem "freien Pool" reservieren (quantity reduzieren)
        for (const unit of unitRecords) {
            await combatMissionsRepo.addMissionUnit(mission.id, unit.id, unit.quantitySent, client);
            await unitsRepo.decrementUserUnitQuantity(unit.id, unit.quantitySent, client);
        }

        logger.info(
            { missionId: mission.id, attackerId, defenderId, distance: distance.toFixed(1), arrivalTime },
            'Combat mission launched'
        );

        // Verteidiger per SSE benachrichtigen (sofern online)
        broadcastToUser(defenderId, 'combat_incoming', {
            missionId: mission.id,
            attackerUsername: attacker.username,
            distance: parseFloat(distance.toFixed(2)),
            arrivalTime: arrivalTime.toISOString(),
        });

        return {
            missionId: mission.id,
            distance: parseFloat(distance.toFixed(2)),
            arrivalTime,
        };
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. TICK: ANKOMMENDE MISSIONEN VERARBEITEN (Kampf)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Wird im Tick-System aufgerufen.
 * Sucht alle Missionen, die ihr Ziel erreicht haben, berechnet den Kampf und startet die Rückreise.
 */
export async function processArrivingMissions() {
    const missions = await combatMissionsRepo.findArrivingMissions();

    for (const mission of missions) {
        await withTransaction(async (client) => {
            await _resolveCombat(mission, client);
        }).catch((err) => {
            logger.error({ err, missionId: mission.id }, 'Failed to resolve arriving combat mission');
        });
    }
}

/**
 * Berechnet den Kampf für eine einzelne Mission.
 *
 * Phasen:
 *  1. Kampftaucher-Phase  – neutralisiert alle defense-Einheiten des Verteidigers
 *  2. Matchup-Berechnung  – Angriffskraft gewichtet nach Matchup-Multiplikator
 *  3. Verlustberechnung   – Einheiten die nicht angreifbar sind, erleiden keine Verluste
 *  4. Persistierung       – Ergebnis + Rückreise-Zeit speichern
 */
async function _resolveCombat(mission, client) {
    // Angreifer-Einheiten der Mission
    const missionUnits = await combatMissionsRepo.findMissionUnits(mission.id, client);

    // Verteidiger-Einheiten (alle mit Menge > 0)
    let defenderUnits = await unitsRepo.findCombatUnitsByUser(mission.defender_id, client);

    // ── Phase 1: Kampftaucher neutralisiert Küstenverteidigung ───────────────
    const hasKampftaucher = missionUnits.some(
        (u) => u.unit_name === 'Kampftaucher' && u.quantity_sent > 0
    );
    if (hasKampftaucher) {
        // defense-Einheiten werden für diese Kampfrunde auf 0 gesetzt (keine Verluste, aber kein Beitrag)
        defenderUnits = defenderUnits.map((u) =>
            u.category === 'defense' ? { ...u, quantity: 0 } : u
        );
        logger.info({ missionId: mission.id }, 'Kampftaucher: Küstenverteidigung neutralisiert');
    }

    // ── Phase 2: Effektive Angriffskraft (unit-vs-unit-Matchup) ────────────────
    const activeDefs = defenderUnits.filter((u) => u.quantity > 0);

    // Kein Verteidiger → automatischer Sieg für den Angreifer
    if (activeDefs.length === 0) {
        const attackPower = 1;
        const defensePower = 0;
        const attackerWon = true;
        const attackerCasualtyRate = 0;
        const defenderCasualtyRate = 0;

        const attackerResults = [];
        for (const mu of missionUnits) {
            attackerResults.push({
                missionUnitId: mu.id,
                userUnitId: mu.user_unit_id,
                unitName: mu.unit_name,
                sent: mu.quantity_sent,
                survived: mu.quantity_sent,
                losses: 0,
            });
            await combatMissionsRepo.setMissionUnitReturned(mu.id, mu.quantity_sent, client);
        }

        const returnSpeed = slowestSpeed(missionUnits.length > 0 ? missionUnits : [{ movement_speed: 1 }]);
        const returnTime = calcArrivalTime(mission.distance, returnSpeed);

        const plunderedBuildings = await _plunderBuildings(mission.defender_id, client);

        const combatResult = {
            attackerWon,
            attackPower,
            defensePower,
            attackerCasualtyRate,
            defenderCasualtyRate,
            kampftaucherUsed: hasKampftaucher,
            attackerUnits: attackerResults,
            defenderUnits: [],
            plunderedBuildings,
            resolvedAt: new Date().toISOString(),
        };

        await combatMissionsRepo.updateMissionAfterCombat(mission.id, 'traveling_back', combatResult, returnTime, client);
        logger.info({ missionId: mission.id, plunderedBuildings }, 'Combat resolved: attacker won (no defenders)');
        broadcastToUser(mission.attacker_id, 'combat_result', {
            missionId: mission.id,
            attackerWon,
            attackerUsername: mission.attacker_username,
            defenderUsername: mission.defender_username,
            returnTime: returnTime.toISOString(),
        });
        broadcastToUser(mission.defender_id, 'combat_result', {
            missionId: mission.id,
            attackerWon,
            attackerUsername: mission.attacker_username,
            defenderUsername: mission.defender_username,
            returnTime: returnTime.toISOString(),
        });
        return;
    }

    let attackPower = 0;
    for (const u of missionUnits) {
        if (!u.quantity_sent) continue;

        // Welche Defender-Einheiten kann diese Einheit angreifen?
        const reachable = activeDefs.filter((d) => getUnitMatchup(u.unit_name, d.unit_name) > 0);
        if (reachable.length === 0) continue; // Kann niemanden treffen → kein Beitrag

        // Durchschnitts-Multiplikator über alle erreichbaren Defender-Einheiten
        const avgMult =
            reachable.reduce((sum, d) => sum + getUnitMatchup(u.unit_name, d.unit_name), 0) /
            reachable.length;

        attackPower += u.attack_points * u.quantity_sent * (u.health_percentage / 100) * avgMult;
    }

    // ── Phase 3: Effektive Verteidigungskraft ─────────────────────────────────
    // Nur Einheiten zählen, die von mindestens einem Angreifer getroffen werden können
    let defensePower = 0;
    for (const u of activeDefs) {
        const canBeHit = missionUnits.some((a) => getUnitMatchup(a.unit_name, u.unit_name) > 0);
        if (!canBeHit) continue; // Immun – kein Angreifer kann diese Einheit treffen
        defensePower += u.defense_points * u.quantity * (u.health_percentage / 100);
    }

    // Schadensverhältnis
    const totalPower = attackPower + defensePower || 1;
    const attackerCasualtyRate = Math.min(1, defensePower / totalPower);
    const defenderCasualtyRate = Math.min(1, attackPower  / totalPower);
    const attackerWon = attackPower > defensePower;

    // ── Verluste Angreifer ────────────────────────────────────────────────────
    const attackerResults = [];
    for (const mu of missionUnits) {
        const survived = Math.floor(mu.quantity_sent * (1 - attackerCasualtyRate));
        const losses = Math.max(0, mu.quantity_sent - survived);
        attackerResults.push({
            missionUnitId: mu.id,
            userUnitId: mu.user_unit_id,
            unitName: mu.unit_name,
            sent: mu.quantity_sent,
            survived,
            losses,
        });
        await combatMissionsRepo.setMissionUnitReturned(mu.id, survived, client);
    }

    // ── Verluste Verteidiger ──────────────────────────────────────────────────
    // Nur Einheiten die angreifbar waren bekommen Verluste; immune bleiben unberührt
    const defenderResults = [];
    for (const du of defenderUnits) {
        const canBeHit = missionUnits.some((a) => getUnitMatchup(a.unit_name, du.unit_name) > 0);
        const losses = canBeHit ? Math.floor(du.quantity * defenderCasualtyRate) : 0;
        const remaining = du.quantity - losses;
        await unitsRepo.setUserUnitQuantity(du.id, remaining, client);
        if (remaining === 0) await unitsRepo.setUnitHealth(du.id, 0, client);
        defenderResults.push({ unitId: du.id, unitName: du.unit_name, losses, remaining });
    }

    // ── Rückreise-Zeit ────────────────────────────────────────────────────────
    const returnSpeed = slowestSpeed(missionUnits.length > 0 ? missionUnits : [{ movement_speed: 1 }]);
    const returnTime = calcArrivalTime(mission.distance, returnSpeed);

    // ── Plünderung bei Sieg ───────────────────────────────────────────────────
    const plunderedBuildings = attackerWon ? await _plunderBuildings(mission.defender_id, client) : [];

    // ── Ergebnis persistieren ─────────────────────────────────────────────────
    const combatResult = {
        attackerWon,
        attackPower: parseFloat(attackPower.toFixed(2)),
        defensePower: parseFloat(defensePower.toFixed(2)),
        attackerCasualtyRate: parseFloat(attackerCasualtyRate.toFixed(3)),
        defenderCasualtyRate: parseFloat(defenderCasualtyRate.toFixed(3)),
        kampftaucherUsed: hasKampftaucher,
        attackerUnits: attackerResults,
        defenderUnits: defenderResults,
        plunderedBuildings,
        resolvedAt: new Date().toISOString(),
    };

    await combatMissionsRepo.updateMissionAfterCombat(
        mission.id,
        'traveling_back',
        combatResult,
        returnTime,
        client
    );

    logger.info(
        {
            missionId: mission.id,
            attackerWon,
            attackPower: attackPower.toFixed(1),
            defensePower: defensePower.toFixed(1),
            hasKampftaucher,
        },
        'Combat resolved'
    );

    // ── SSE: Beide Spieler benachrichtigen ────────────────────────────────────
    const resultPayload = {
        missionId: mission.id,
        attackerWon,
        attackerUsername: mission.attacker_username,
        defenderUsername: mission.defender_username,
        returnTime: returnTime.toISOString(),
    };
    broadcastToUser(mission.attacker_id, 'combat_result', resultPayload);
    broadcastToUser(mission.defender_id, 'combat_result', resultPayload);
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. TICK: RÜCKKEHRENDE MISSIONEN ABSCHLIESSEN
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Wird im Tick-System aufgerufen.
 * Überlebende Einheiten werden dem Spieler zurückgegeben, Mission als 'completed' markiert.
 */
export async function processReturningMissions() {
    const missions = await combatMissionsRepo.findReturningMissions();

    for (const mission of missions) {
        await withTransaction(async (client) => {
            const missionUnits = await combatMissionsRepo.findMissionUnits(mission.id, client);

            for (const mu of missionUnits) {
                const returned = mu.quantity_returned ?? 0;
                if (returned > 0) {
                    await unitsRepo.addUnitQuantity(mu.user_unit_id, returned, client);
                }
            }

            await combatMissionsRepo.completeMission(mission.id, client);

            logger.info({ missionId: mission.id }, 'Combat mission completed – units returned');

            // Angreifer benachrichtigen
            broadcastToUser(mission.attacker_id, 'combat_return', {
                missionId: mission.id,
                defenderUsername: mission.defender_username,
            });
        }).catch((err) => {
            logger.error({ err, missionId: mission.id }, 'Failed to complete returning combat mission');
        });
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// ABFRAGEN (für Routen)
// ─────────────────────────────────────────────────────────────────────────────

export async function getActiveMissions(userId) {
    return combatMissionsRepo.findActiveMissionsByAttacker(userId);
}

export async function getIncomingAttacks(userId) {
    return combatMissionsRepo.findIncomingMissionsByDefender(userId);
}

export async function getMissionHistory(userId) {
    return combatMissionsRepo.findMissionHistory(userId);
}

export async function getMissionHistoryEntry(userId, missionId) {
    return combatMissionsRepo.findMissionHistoryEntry(userId, missionId);
}
