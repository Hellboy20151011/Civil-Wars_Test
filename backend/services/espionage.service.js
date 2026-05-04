/**
 * Espionage Service – distanzbasierte Spionage-Missionen zwischen Spielern
 *
 * Ablauf:
 *   1. launchSpyMission()             – Spieler sendet Spione
 *   2. processArrivingSpyMissions()   – Tick: Spione kommen an → Erfolg/Misserfolg berechnen,
 *                                       Bericht erstellen, Rückreise starten
 *   3. processReturningSpyMissions()  – Tick: Spione zurück → Mengen anpassen, Mission abschließen
 *
 * Erfolgsformel (pro Spion unabhängig):
 *   base = 50 + 10 * intelLevel(Angreifer) - 15 * counterIntelLevel(Verteidiger)
 *          + 5 * unitBonus(SR-71/Satellit)
 *   clamp(10, 95) pro Spion
 *
 * Berichtsdetail skaliert mit Erfolgsrate:
 *   < 30%  → nur Gebäudekategorien ohne Mengen
 *   30–60% → Gebäude mit Mengen, Einheitenkategorien ohne Mengen
 *   > 60%  → vollständiger Bericht (Gebäude, alle Einheiten, Verteidigungen)
 */

import * as spyRepo from '../repositories/spy-missions.repository.js';
import * as playerRepo from '../repositories/player.repository.js';
import * as unitsRepo from '../repositories/units.repository.js';
import { withTransaction } from '../repositories/transaction.repository.js';
import { broadcastToUser } from './live-updates.service.js';
import { config } from '../config.js';
import { logger } from '../logger.js';
import { createServiceError } from './service-error.js';

// ─────────────────────────────────────────────────────────────────────────────
// HILFSFUNKTIONEN
// ─────────────────────────────────────────────────────────────────────────────

function calcDistance(x1, y1, x2, y2) {
    return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
}

function calcArrivalTime(distance, speed) {
    const travelTicks = distance / speed;
    const tickMs = config.gameloop.tickIntervalMs;
    return new Date(Date.now() + travelTicks * tickMs);
}

/**
 * Erfolgswahrscheinlichkeit für einen einzelnen Spion (0–1).
 * @param {number} intelLevel        – Geheimdienstzentrum-Level des Angreifers (0–3)
 * @param {number} counterIntelLevel – Gegenspionage-Level des Verteidigers (0–3)
 * @param {string} unitName          – Einheitenname für Bonus
 * @returns {number} 0.10 … 0.95
 */
function calcSuccessRate(intelLevel, counterIntelLevel, unitName) {
    let base = 50 + 10 * intelLevel - 15 * counterIntelLevel;

    // Fortgeschrittene Geheimdiensteinheiten haben Boni
    if (unitName === 'SR-71 Aufklärer') base += 15;
    if (unitName === 'Spionagesatellit') base += 30;

    return Math.min(95, Math.max(10, base)) / 100;
}

/**
 * Baut den Spionage-Bericht abhängig von der Erfolgsrate.
 * @param {number}   successRate  – 0.1–0.95
 * @param {number}   spiesCaught  – erwischte Spione
 * @param {string}   targetUsername
 * @param {object}   buildingSummary – { category: count }
 * @param {Array}    unitSummary     – [{ name, category, quantity }]
 * @returns {object} report-Objekt
 */
function buildReport(successRate, spiesCaught, targetUsername, buildingSummary, unitSummary) {
    if (successRate < 0.30) {
        // Nur Kategorienübersicht
        return {
            success: true,
            detail: 'low',
            targetUsername,
            spiesCaught,
            buildings: {
                categories: Object.keys(buildingSummary),
            },
        };
    }

    if (successRate < 0.60) {
        // Gebäude mit Mengen, Einheitenkategorien
        const unitCategories = [...new Set(unitSummary.map((u) => u.category))];
        return {
            success: true,
            detail: 'medium',
            targetUsername,
            spiesCaught,
            buildings: buildingSummary,
            units: { categories: unitCategories },
        };
    }

    // Vollständiger Bericht
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
        detail: 'full',
        targetUsername,
        spiesCaught,
        buildings: buildingSummary,
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

        // Einheiten validieren: nur 'intel'-Kategorie erlaubt
        const unitDetails = [];
        let totalSpies = 0;

        for (const u of units) {
            const unit = await unitsRepo.findUserUnitById(u.user_unit_id, client);
            if (!unit || unit.user_id !== spyPlayerId) {
                throw createServiceError(`Einheit ${u.user_unit_id} nicht gefunden`, 404, 'UNIT_NOT_FOUND');
            }
            if (unit.category !== 'intel') {
                throw createServiceError(
                    `Nur Geheimdiensteinheiten können Spionage-Missionen durchführen`,
                    400,
                    'INVALID_UNIT_CATEGORY'
                );
            }
            if (unit.is_moving) {
                throw createServiceError(`Einheit ${unit.name} ist bereits im Einsatz`, 409, 'UNIT_BUSY');
            }
            if (unit.quantity < u.quantity) {
                throw createServiceError(
                    `Nicht genug ${unit.name} vorhanden (${unit.quantity} verfügbar)`,
                    400,
                    'INSUFFICIENT_UNITS'
                );
            }
            unitDetails.push({ ...unit, quantitySending: u.quantity });
            totalSpies += u.quantity;
        }

        // Langsamste Einheit bestimmt die Reisezeit
        const speed = Math.min(...unitDetails.map((u) => Number(u.movement_speed)));
        const arrivalTime = calcArrivalTime(distance, speed);

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
            await unitsRepo.decrementUserUnitQuantity(u.id, u.quantitySending, client);
            await spyRepo.addMissionUnit(mission.id, u.id, u.quantitySending, client);
            // Markiere als bewegend (Menge wurde bereits reduziert)
        }

        return {
            missionId: mission.id,
            arrivalTime,
            distance: Math.round(distance * 10) / 10,
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

    // Geheimdienstzentrum-Level des Angreifers + Gegenspionage-Level des Verteidigers
    const [intelLevel, counterIntelLevel] = await Promise.all([
        spyRepo.findIntelLevel(mission.spy_id, client),
        spyRepo.findCounterIntelLevel(mission.target_id, client),
    ]);

    let successfulSpies = 0;
    let caughtSpies = 0;
    let bestSuccessRate = 0;

    for (const mu of missionUnits) {
        const rate = calcSuccessRate(intelLevel, counterIntelLevel, mu.name);
        bestSuccessRate = Math.max(bestSuccessRate, rate);

        for (let i = 0; i < mu.quantity_sent; i++) {
            if (Math.random() < rate) {
                successfulSpies++;
            } else {
                caughtSpies++;
            }
        }
    }

    const totalSent = mission.spies_sent;
    const survivalRate = successfulSpies / totalSent;

    // Rückreisezeit: gleiche Distanz, gleiche Geschwindigkeit
    const speed = Math.min(...missionUnits.map((u) => Number(u.movement_speed)));
    const returnTime = calcArrivalTime(mission.distance, speed);

    let report;
    let newStatus;

    if (successfulSpies === 0) {
        // Alle Spione erwischt
        report = {
            success: false,
            targetUsername: mission.target_username,
            spiesCaught: caughtSpies,
        };
        newStatus = 'aborted';
    } else {
        // Mindestens ein Spion erfolgreich
        const [buildingSummary, unitSummary] = await Promise.all([
            spyRepo.findBuildingSummaryForReport(mission.target_id, client),
            spyRepo.findUnitSummaryForReport(mission.target_id, client),
        ]);

        report = buildReport(
            bestSuccessRate * survivalRate,
            caughtSpies,
            mission.target_username,
            buildingSummary,
            unitSummary
        );
        newStatus = 'traveling_back';
    }

    await spyRepo.setMissionResult(mission.id, newStatus, report, returnTime, client);

    // Verteidiger benachrichtigen (wenn Spione erwischt wurden)
    if (caughtSpies > 0) {
        broadcastToUser(mission.target_id, 'spy_detected', {
            spiesCaught: caughtSpies,
            originUsername: mission.spy_username,
        });
    }

    // Angreifer benachrichtigen: Mission abgeschlossen oder unterwegs zurück
    broadcastToUser(mission.spy_id, 'spy_mission_update', {
        missionId: mission.id,
        status: newStatus,
        targetUsername: mission.target_username,
        spiesCaught: caughtSpies,
        successfulSpies,
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
    const report = mission.report ?? {};
    const spiesCaught = Number(report.spiesCaught ?? 0);
    const totalSent = mission.spies_sent;
    const surviving = totalSent - spiesCaught;

    // Einheiten zurückgeben (nur Überlebende)
    let remainingToReturn = surviving;
    for (const mu of missionUnits) {
        if (remainingToReturn <= 0) break;
        const returnQty = Math.min(remainingToReturn, mu.quantity_sent);
        await unitsRepo.addUnitQuantity(mu.user_unit_id, returnQty, client);
        await spyRepo.setUnitQuantityReturned(mission.id, mu.user_unit_id, returnQty, client);
        remainingToReturn -= returnQty;
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

    const unitDetails = await Promise.all(
        unitIds.map((id) => unitsRepo.findUserUnitById(id))
    );

    const validUnits = unitDetails.filter(Boolean);
    if (validUnits.length === 0) throw createServiceError('Keine gültigen Einheiten', 400, 'UNIT_NOT_FOUND');

    const speed = Math.min(...validUnits.map((u) => Number(u.movement_speed)));
    const travelTicks = distance / speed;
    const tickMs = config.gameloop.tickIntervalMs;
    const travelMs = travelTicks * tickMs;

    // Treibstoffverbrauch: fuel_cost * distance / 10 pro Einheit
    const fuelCost = validUnits.reduce((acc, u) => {
        return acc + Math.ceil(Number(u.fuel_cost) * distance / 10);
    }, 0);

    const [intelLevel, counterIntelLevel] = await Promise.all([
        spyRepo.findIntelLevel(spyPlayerId),
        spyRepo.findCounterIntelLevel(targetPlayerId),
    ]);

    const estimatedSuccessRate = Math.min(95, Math.max(10,
        50 + 10 * intelLevel - 15 * counterIntelLevel
    ));

    return {
        distance: Math.round(distance * 10) / 10,
        travelMinutes: Math.round(travelMs / 60000),
        arrivalTime: new Date(Date.now() + travelMs).toISOString(),
        fuelCost,
        estimatedSuccessRate,
        targetUsername: target.username,
        targetCoords: { x: target.koordinate_x, y: target.koordinate_y },
    };
}
