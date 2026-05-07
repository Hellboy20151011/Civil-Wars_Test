/**
 * Espionage Service – distanzbasierte Spionage-Missionen zwischen Spielern
 *
 * Ablauf:
 *   1. launchSpyMission()             – Spieler sendet Spione
 *   2. processArrivingSpyMissions()   – Tick: Spione kommen an → Stufe berechnen,
 *                                       Bericht erstellen, Rükreise starten
 *   3. processReturningSpyMissions()  – Tick: Spione zurück → Mengen zurückgeben, Mission abschließen
 *
 * Aggregationsformel:
 *   Gesamtangriff  = SUM(spy_attack  * quantity_sent)  (gesendete Spione)
 *   Gesamtabwehr   = SUM(spy_defense * quantity)        (Intel-Einheiten des Verteidigers zu Hause)
 *   ratio          = Gesamtangriff / Gesamtabwehr  (0 = keine Abwehr → immer Stufe 3)
 *
 * Stufen:
 *   ratio < 1.05  → Fehlschlag  – alle Spione verloren, Verteidiger benachrichtigt
 *   1.05 – 1.30   → Stufe 1    – raubbare Gebäude grob (±5%) + Abwehr ±5%
 *   1.30 – 1.65   → Stufe 2    – Produktionsgebäude exakt + Gesamtzahl Einheiten/Verteidigung
 *   > 1.65        → Stufe 3    – vollständige Auflistung, Verteidiger NICHT benachrichtigt
 */

import * as spyRepo from '../repositories/spy-missions.repository.js';
import * as playerRepo from '../repositories/player.repository.js';
import * as unitsRepo from '../repositories/units.repository.js';
import * as resourcesRepo from '../repositories/resources.repository.js';
import { withTransaction } from '../repositories/transaction.repository.js';
import { broadcastToUser } from './live-updates.service.js';
import { config } from '../config.js';
import { logger } from '../logger.js';
import { createServiceError } from './service-error.js';
import { calcDistance, calcArrivalTime, calculateFuelCost } from '../utils/game-math.js';

// ─────────────────────────────────────────────────────────────────────────────
// HILFSFUNKTIONEN
// ─────────────────────────────────────────────────────────────────────────────

// Gebäude, die im Kampfsystem plünderbar sind (identisch mit combat.service.js)
const PLUNDERABLE_BUILDINGS = [
    'Wohnhaus', 'Reihenhaus', 'Mehrfamilienhaus', 'Hochhaus',
    'Kraftwerk', 'Steinbruch', 'Stahlwerk', 'Ölpumpe', 'Öl-Raffinerie',
];

/**
 * Liefert einen zufälligen Wert innerhalb von ±varianceFraction um den Basiswert.
 */
function fuzz(base, varianceFraction) {
    const factor = 1 + (Math.random() * 2 - 1) * varianceFraction;
    return Math.round(base * factor);
}

/**
 * Bestimmt die Stufe anhand des Verhältnisses Angriff/Abwehr.
 * @returns {'failed'|'level1'|'level2'|'level3'}
 */
function determineSpyLevel(totalAttack, totalDefense) {
    if (totalDefense <= 0) return 'level3';
    const ratio = totalAttack / totalDefense;
    if (ratio < 1.05) return 'failed';
    if (ratio < 1.30) return 'level1';
    if (ratio < 1.65) return 'level2';
    return 'level3';
}

/**
 * @deprecated – wird nicht mehr verwendet, nur für Rückwärtskompatibilität behalten
 */
function calcSuccessRate(intelLevel, counterIntelLevel, unitName) {
    if (Number(counterIntelLevel) <= 0) return 1;
    let base = 50 + 10 * intelLevel - 15 * counterIntelLevel;
    if (unitName === 'SR-71 Aufklärer') base += 15;
    if (unitName === 'Spionagesatellit') base += 30;
    return Math.min(95, Math.max(10, base)) / 100;
}

/**
 * Baut den Spionage-Fehlschlag-Bericht.
 */
function buildFailedReport(targetUsername, totalDefense, spiesLost, totalAttack) {
    return {
        success: false,
        detail: 'failed',
        targetUsername,
        spiesLost,
        totalAttack,
        defenseValueFuzzy: fuzz(totalDefense, 0.20),
    };
}

/**
 * Baut den Bericht für Stufe 1 (+10-30 % Überlegenheit).
 */
function buildLevel1Report(targetUsername, plunderableCount, totalDefense, totalAttack) {
    return {
        success: true,
        detail: 'level1',
        targetUsername,
        totalAttack,
        plunderableBuildingsApprox: fuzz(plunderableCount, 0.05),
        defenseValueFuzzy: fuzz(totalDefense, 0.10),
    };
}

/**
 * Baut den Bericht für Stufe 2 (+30-65 % Überlegenheit).
 */
function buildLevel2Report(targetUsername, productionBuildings, unitDefenseTotals, totalDefense, totalAttack) {
    return {
        success: true,
        detail: 'level2',
        targetUsername,
        totalAttack,
        totalDefense: fuzz(totalDefense, 0.05),
        productionBuildings,
        totalUnits:    unitDefenseTotals.totalUnits,
        totalDefenses: unitDefenseTotals.totalDefenses,
    };
}

/**
 * Baut den vollständigen Bericht für Stufe 3 (> 65 % Überlegenheit).
 */
function buildLevel3Report(targetUsername, unitSummary, productionBuildings, totalDefense, totalAttack) {
    const units = {};
    for (const u of unitSummary) {
        if (u.category !== 'intel') {
            units[u.name] = { category: u.category, quantity: Number(u.quantity) };
        }
    }
    const defenses = unitSummary
        .filter((u) => u.category === 'defense')
        .map((u) => ({ name: u.name, quantity: Number(u.quantity) }));
    return {
        success: true,
        detail: 'level3',
        targetUsername,
        totalAttack,
        totalDefense,
        productionBuildings: productionBuildings ?? [],
        units,
        defenses,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// LAUNCH
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Spionage-Mission starten.
 * @param {number} spyPlayerId
 * @param {number} targetPlayerId
 * @param {{ user_unit_id: number, quantity: number }[]} units
 */
export async function launchSpyMission(spyPlayerId, targetPlayerId, units) {
    if (!units || units.length === 0) {
        throw createServiceError('Mindestens eine Einheit erforderlich', 400, 'NO_UNITS');
    }
    if (spyPlayerId === targetPlayerId) {
        throw createServiceError('Kann sich nicht selbst bespitzeln', 400, 'SELF_SPY');
    }

    return withTransaction(async (client) => {
        const [spy, target] = await Promise.all([
            playerRepo.findById(spyPlayerId, client),
            playerRepo.findById(targetPlayerId, client),
        ]);

        if (!spy) throw createServiceError('Eigener Spieler nicht gefunden', 404, 'ATTACKER_NOT_FOUND');
        if (!target) throw createServiceError('Ziel nicht gefunden', 404, 'DEFENDER_NOT_FOUND');

        if (spy.koordinate_x == null || target.koordinate_x == null) {
            throw createServiceError('Koordinaten fehlen', 400, 'MISSING_COORDINATES');
        }

        const distance = calcDistance(
            spy.koordinate_x, spy.koordinate_y,
            target.koordinate_x, target.koordinate_y
        );

        if (distance === 0) {
            throw createServiceError('Ziel befindet sich an der eigenen Position', 400, 'SAME_POSITION');
        }

        // Einheiten validieren: nur 'intel'-Kategorie erlaubt (Batch statt N Einzelqueries)
        const requestedByUnitId = new Map();
        let totalSpies = 0;

        for (const entry of units) {
            const userUnitId = Number(entry.user_unit_id ?? entry.userUnitId);
            const quantity = Number(entry.quantity);

            if (!Number.isInteger(userUnitId) || userUnitId <= 0) {
                throw createServiceError('Ungültige Einheit in Spionageliste', 400, 'INVALID_UNIT_ID');
            }
            if (!Number.isInteger(quantity) || quantity <= 0) {
                throw createServiceError('Ungültige Einheitenmenge', 400, 'INVALID_UNIT_QUANTITY');
            }

            requestedByUnitId.set(userUnitId, (requestedByUnitId.get(userUnitId) ?? 0) + quantity);
            totalSpies += quantity;
        }

        const unitIds = [...requestedByUnitId.keys()];
        const movableUnits = await unitsRepo.findMovableUnitsByIds(spyPlayerId, unitIds, client, {
            forUpdate: true,
        });
        const movableById = new Map(movableUnits.map((unit) => [Number(unit.id), unit]));

        const unitDetails = [];
        for (const userUnitId of unitIds) {
            const unit = movableById.get(userUnitId);
            const requestedQuantity = requestedByUnitId.get(userUnitId);

            if (!unit) {
                throw createServiceError(`Einheit ${userUnitId} nicht gefunden`, 404, 'UNIT_NOT_FOUND');
            }
            if (unit.category !== 'intel') {
                throw createServiceError(
                    'Nur Geheimdiensteinheiten können Spionage-Missionen durchführen',
                    400,
                    'INVALID_UNIT_CATEGORY'
                );
            }
            if (unit.is_moving) {
                throw createServiceError(`Einheit ${unit.name} ist bereits im Einsatz`, 409, 'UNIT_BUSY');
            }
            if (Number(unit.quantity) < requestedQuantity) {
                throw createServiceError(
                    `Nicht genug ${unit.name} vorhanden (${unit.quantity} verfügbar)`,
                    400,
                    'INSUFFICIENT_UNITS'
                );
            }

            unitDetails.push({ ...unit, quantitySending: requestedQuantity });
        }

        // Langsamste Einheit bestimmt die Reisezeit
        const speed = Math.min(...unitDetails.map((u) => Number(u.movement_speed)));
        const arrivalTime = calcArrivalTime(distance, speed);
        const fuelCost = calculateFuelCost(distance, unitDetails);

        const resources = (await resourcesRepo.findByUserIdLocked(spyPlayerId, client)) ?? {
            treibstoff: 0,
        };

        if (Number(resources.treibstoff ?? 0) < fuelCost) {
            throw createServiceError('Nicht genug Treibstoff für die Mission', 400, 'INSUFFICIENT_RESOURCES');
        }

        try {
            await resourcesRepo.deductResources(spyPlayerId, 0, 0, 0, fuelCost, client);
        } catch (error) {
            if (error?.code === 'INSUFFICIENT_RESOURCES') {
                throw createServiceError('Nicht genug Treibstoff für die Mission', 400, 'INSUFFICIENT_RESOURCES');
            }
            throw error;
        }

        // Mission anlegen
        const mission = await spyRepo.createMission({
            spyId: spyPlayerId,
            targetId: targetPlayerId,
            originX: spy.koordinate_x,
            originY: spy.koordinate_y,
            targetX: target.koordinate_x,
            targetY: target.koordinate_y,
            distance,
            spiesSent: totalSpies,
            arrivalTime,
        }, client);

        // Einheiten reservieren (Menge reduzieren)
        for (const u of unitDetails) {
            try {
                await unitsRepo.decrementUserUnitQuantity(u.id, u.quantitySending, client);
            } catch (error) {
                if (error?.code === 'INSUFFICIENT_UNITS') {
                    throw createServiceError(
                        `Nicht genug ${u.name} vorhanden (${u.quantity} verfügbar)`,
                        400,
                        'INSUFFICIENT_UNITS'
                    );
                }
                throw error;
            }
            await spyRepo.addMissionUnit(mission.id, u.id, u.quantitySending, client);
            // Markiere als bewegend (Menge wurde bereits reduziert)
        }

        return {
            missionId: mission.id,
            arrivalTime,
            distance: Math.round(distance * 10) / 10,
            fuelCost,
            spiesSent: totalSpies,
            targetUsername: target.username,
        };
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// TICK: ANKOMMENDE MISSIONEN
// ─────────────────────────────────────────────────────────────────────────────

export async function processArrivingSpyMissions() {
    const now = new Date();

    // Jede Mission in eigener Transaktion – ein Fehler betrifft nicht andere Missionen
    const missions = await spyRepo.findArrivingMissions(now);

    for (const mission of missions) {
        try {
            await withTransaction(async (client) => {
                await processOneMission(mission, client);
            });
        } catch (err) {
            logger.error({ err, missionId: mission.id }, 'Fehler bei Spionage-Mission');
        }
    }
}

async function processOneMission(mission, client) {
    const missionUnits = await spyRepo.findMissionUnits(mission.id, client);

    // Gesamtangriff (gesendete Spione) und Gesamtabwehr (Verteidiger zu Hause)
    const totalAttack  = missionUnits.reduce((sum, mu) => sum + Number(mu.spy_attack) * mu.quantity_sent, 0);
    const totalDefense = await spyRepo.findTotalSpyDefense(mission.target_id, client);

    const level = determineSpyLevel(totalAttack, totalDefense);

    // Rückreisezeit: gleiche Distanz, gleiche Geschwindigkeit
    const speed      = Math.min(...missionUnits.map((u) => Number(u.movement_speed)));
    const returnTime = calcArrivalTime(mission.distance, speed);

    let report;
    let newStatus;
    let notifyDefender = true;

    if (level === 'failed') {
        // Alle Spione verloren
        report    = buildFailedReport(mission.target_username, totalDefense, mission.spies_sent, totalAttack);
        newStatus = 'aborted';
    } else {
        newStatus = 'traveling_back';

        if (level === 'level1') {
            const plunderableCount = await spyRepo.findPlunderableBuildingCount(
                mission.target_id, PLUNDERABLE_BUILDINGS, client
            );
            report = buildLevel1Report(mission.target_username, plunderableCount, totalDefense, totalAttack);

        } else if (level === 'level2') {
            const [productionBuildings, unitDefenseTotals] = await Promise.all([
                spyRepo.findProductionBuildingsForReport(mission.target_id, client),
                spyRepo.findUnitDefenseTotalsForReport(mission.target_id, client),
            ]);
            report = buildLevel2Report(mission.target_username, productionBuildings, unitDefenseTotals, totalDefense, totalAttack);

        } else {
            // level3 – vollständiger Bericht, Verteidiger NICHT benachrichtigt
            const [unitSummary, productionBuildings] = await Promise.all([
                spyRepo.findUnitSummaryForReport(mission.target_id, client),
                spyRepo.findProductionBuildingsForReport(mission.target_id, client),
            ]);
            report         = buildLevel3Report(mission.target_username, unitSummary, productionBuildings, totalDefense, totalAttack);
            notifyDefender = false;
        }
    }

    await spyRepo.setMissionResult(mission.id, newStatus, report, returnTime, client);

    // Verteidiger benachrichtigen (außer bei Stufe 3)
    if (notifyDefender) {
        broadcastToUser(mission.target_id, 'spy_detected', {
            spiesDetected: level === 'failed' ? mission.spies_sent : 0,
            originUsername: mission.spy_username,
        });
    }

    // Angreifer benachrichtigen
    broadcastToUser(mission.spy_id, 'spy_mission_update', {
        missionId: mission.id,
        status:    newStatus,
        level,
        targetUsername: mission.target_username,
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// TICK: RÜCKKEHRENDE MISSIONEN
// ─────────────────────────────────────────────────────────────────────────────

export async function processReturningSpyMissions() {
    const now = new Date();

    // Jede Mission in eigener Transaktion
    const missions = await spyRepo.findReturningMissions(now);

    for (const mission of missions) {
        try {
            await withTransaction(async (client) => {
                await finalizeReturnedMission(mission, client);
            });
        } catch (err) {
            logger.error({ err, missionId: mission.id }, 'Fehler bei Rückkehr von Spionage-Mission');
        }
    }
}

async function finalizeReturnedMission(mission, client) {
    const missionUnits = await spyRepo.findMissionUnits(mission.id, client);
    // Bei erfolgreichen Missionen (traveling_back) kehren alle Spione zurück.
    // Fehlgeschlagene Missionen ('aborted') erreichen diese Funktion nie.
    const surviving = mission.spies_sent;

    for (const mu of missionUnits) {
        await unitsRepo.addUnitQuantity(mu.user_unit_id, mu.quantity_sent, client);
        await spyRepo.setUnitQuantityReturned(mission.id, mu.user_unit_id, mu.quantity_sent, client);
    }

    await spyRepo.completeMission(mission.id, surviving, client);

    // Spieler benachrichtigen
    broadcastToUser(mission.spy_id, 'spy_return', {
        missionId: mission.id,
        targetUsername: mission.target_username,
        spiesReturned: surviving,
        report: mission.report,
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// QUERY-ENDPUNKTE
// ─────────────────────────────────────────────────────────────────────────────

export async function getActiveMissions(userId) {
    return spyRepo.findActiveMissionsBySpy(userId);
}

export async function getReports(userId) {
    return spyRepo.findReportsByUser(userId);
}

/**
 * Berechnet Vorschau-Infos (Reisezeit, Treibstoffverbrauch) ohne Mission anzulegen.
 */
export async function getMissionPreview(spyPlayerId, targetPlayerId, unitIds) {
    const [spy, target] = await Promise.all([
        playerRepo.findById(spyPlayerId),
        playerRepo.findById(targetPlayerId),
    ]);

    if (!spy || !target) throw createServiceError('Spieler nicht gefunden', 404, 'DEFENDER_NOT_FOUND');

    const distance = calcDistance(
        spy.koordinate_x, spy.koordinate_y,
        target.koordinate_x, target.koordinate_y
    );

    if (!Array.isArray(unitIds) || unitIds.length === 0) {
        throw createServiceError('Keine gültigen Einheiten', 400, 'UNIT_NOT_FOUND');
    }

    const unitDetails = [];

    for (const entry of unitIds) {
        const userUnitId = Number(entry?.user_unit_id);
        const quantity = Number(entry?.quantity ?? 1);
        const unit = await unitsRepo.findUserUnitById(userUnitId);

        if (!unit || Number(unit.user_id) !== Number(spyPlayerId)) {
            throw createServiceError(`Einheit ${userUnitId} nicht gefunden`, 404, 'UNIT_NOT_FOUND');
        }
        if (unit.category !== 'intel') {
            throw createServiceError(
                'Nur Geheimdiensteinheiten können Spionage-Missionen durchführen',
                400,
                'INVALID_UNIT_CATEGORY'
            );
        }
        if (!Number.isFinite(quantity) || quantity <= 0) {
            throw createServiceError('Menge muss größer als 0 sein', 400, 'INVALID_QUANTITY');
        }
        if (Number(unit.quantity) < quantity) {
            throw createServiceError(
                `Nicht genug ${unit.name} vorhanden (${unit.quantity} verfügbar)`,
                400,
                'INSUFFICIENT_UNITS'
            );
        }

        unitDetails.push({ ...unit, quantitySending: quantity });
    }

    const speed = Math.min(...unitDetails.map((u) => Number(u.movement_speed)));
    const travelTicks = distance / speed;
    const tickMs = config.gameloop.tickIntervalMs;
    const travelMs = travelTicks * tickMs;

    const fuelCost = calculateFuelCost(distance, unitDetails);

    return {
        distance: Math.round(distance * 10) / 10,
        travelMinutes: Math.round(travelMs / 60000),
        arrivalTime: new Date(Date.now() + travelMs).toISOString(),
        fuelCost,
        targetUsername: target.username,
        targetCoords: { x: target.koordinate_x, y: target.koordinate_y },
    };
}
