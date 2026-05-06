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
import * as resourcesRepo from '../repositories/resources.repository.js';
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

const LOOT_POOL_RATE = 0.20; // 20 % Loot-Pool pro Angriff
const MAX_DAILY_ATTACKS_PER_TARGET = 6;

// Pro Ölpumpe dürfen maximal 5 Öl-Raffinerien betrieben werden
const MAX_RAFFINERIEN_PER_PUMPE = 5;
const PLUNDERABLE_BUILDINGS = new Set([
    'Wohnhaus',
    'Reihenhaus',
    'Mehrfamilienhaus',
    'Hochhaus',
    'Kraftwerk',
    'Steinbruch',
    'Stahlwerk',
    'Ölpumpe',
    'Öl-Raffinerie',
]);

/**
 * Zerstört einen Teil der plünderbaren Gebäude des Verteidigers.
 * Regeln:
 *   - Nur explizit plünderbare Gebäudetypen
 *   - Mindestens 1 Gebäude jedes Typs bleibt erhalten
 *   - Ölpumpe/Öl-Raffinerie-Verhältnis: max. 5 Raffinerien pro Pumpe nach Plünderung
 *   - Kraftwerke werden zuletzt entfernt, um kein Stromdefizit beim Verteidiger auszulösen
 *
 * @param {number} attackerId
 * @param {number} defenderId
 * @param {number} raidPercent   – Anteil in [0..1], abgeleitet aus Verteidiger-Verlustquote
 * @param {import('pg').PoolClient} client
 * @returns {Promise<Array<{ name: string, removed: number, remaining: number }>>}
 */
async function _plunderBuildings(attackerId, defenderId, raidPercent, client) {
    const normalizedRaidPercent = Math.min(1, Math.max(0, Number(raidPercent) || 0));
    if (normalizedRaidPercent <= 0) return [];

    const buildings = await buildingRepo.findBuildingsByUser(defenderId, client);

    // Plünderbare Gebäude werden ausschließlich per Name gesteuert.
    const plunderable = buildings.filter((b) => PLUNDERABLE_BUILDINGS.has(b.name));

    // ── Schritt 1: Entfernungsplan erstellen (ohne Kraftwerke) ────────────────
    // Map: building.id → { b, toRemove }
    const plan = new Map();
    for (const b of plunderable.filter((b) => Number(b.power_production) <= 0)) {
        const count = Number(b.anzahl);
        const rawStolen = Math.floor(count * LOOT_POOL_RATE * normalizedRaidPercent);
        const toRemove = Math.max(0, Math.min(rawStolen, count - 1));
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
        await buildingRepo.upsertBuilding(attackerId, b.id, toRemove, client);
        plunderLog.push({ name: b.name, removed: toRemove, remaining: Number(b.anzahl) - toRemove });
    }

    // ── Schritt 4: Kraftwerke – Strom-Sicherheitscheck ───────────────────────
    // Aktuell nach obigen Entfernungen lesen (Verbrauch ist gesunken)
    for (const b of plunderable.filter((b) => Number(b.power_production) > 0)) {
        const count = Number(b.anzahl);
        const rawStolen = Math.floor(count * LOOT_POOL_RATE * normalizedRaidPercent);
        let toRemove = Math.max(0, Math.min(rawStolen, count - 1));
        if (toRemove <= 0) continue;

        const { production, consumption } = await buildingRepo.findPowerSummaryByUser(defenderId, client);
        const powerPerUnit = Number(b.power_production);
        // Maximal entfernbar ohne Defizit: floor((prod - cons) / powerPerUnit)
        const maxRemovable = Math.floor((Number(production) - Number(consumption)) / powerPerUnit);
        toRemove = Math.min(toRemove, Math.max(0, maxRemovable), count - 1);
        if (toRemove <= 0) continue;

        await buildingRepo.removeUserBuildingsByType(defenderId, b.id, toRemove, client);
        await buildingRepo.upsertBuilding(attackerId, b.id, toRemove, client);
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
    if (typeof val !== 'number' || !Number.isFinite(val) || val <= 0) return 0;
    return val;
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

function calculateFuelCost(distance, units) {
    return units.reduce((acc, unit) => {
        const quantity = Math.max(0, Number(unit.quantitySent ?? 0));
        const fuelPerUnit = Number(unit.fuel_cost);
        const normalizedFuelPerUnit = Number.isFinite(fuelPerUnit) ? fuelPerUnit : 0;
        return acc + Math.ceil((normalizedFuelPerUnit * distance * quantity) / 10);
    }, 0);
}

function toEffectiveHitpoints(unit) {
    const baseHitpoints = Math.max(1, Number(unit.hitpoints) || 1);
    const healthFactor = Math.max(0, Number(unit.health_percentage) || 0) / 100;
    // defense_points erhöhen effektive HP: +1 % pro Punkt
    const defenseFactor = 1 + Math.max(0, Number(unit.defense_points) || 0) / 100;
    return Math.max(1, baseHitpoints * healthFactor * defenseFactor);
}

function sumMapValues(map) {
    let sum = 0;
    for (const value of map.values()) sum += Number(value) || 0;
    return sum;
}

/**
 * Rundenbasierte Kampfsimulation.
 * Pro Runde greifen beide Seiten gleichzeitig an. Schaden akkumuliert sich in
 * einem Pool pro Einheitentyp; sobald der Pool ≥ effektive HP erreicht, stirbt
 * eine Einheit. So können auch kleine Einheitenzahlen (z. B. 1 vs. 1) nach
 * mehreren Runden Verluste erleiden.
 *
 * @returns {{ attackerLosses: Map, defenderLosses: Map, attackDamage: number, defenseDamage: number }}
 */
function simulateCombatRounds(attackerUnits, defenderUnits) {
    const MAX_ROUNDS = 1000;

    const atk = attackerUnits.map((u) => ({
        id: u.id,
        unit_name: u.unit_name,
        attack_points: Number(u.attack_points || 0),
        defense_points: Number(u.defense_points || 0),
        hitpoints: Number(u.hitpoints || 1),
        health_percentage: Number(u.health_percentage ?? 100),
        remaining: Number(u.quantity),
        damagePool: 0,
    }));
    const def = defenderUnits.map((u) => ({
        id: u.id,
        unit_name: u.unit_name,
        attack_points: Number(u.attack_points || 0),
        defense_points: Number(u.defense_points || 0),
        hitpoints: Number(u.hitpoints || 1),
        health_percentage: Number(u.health_percentage ?? 100),
        remaining: Number(u.quantity),
        damagePool: 0,
    }));

    let attackDamage = 0;
    let defenseDamage = 0;
    let rounds = 0;
    const roundLog = [];

    for (let round = 0; round < MAX_ROUNDS; round++) {
        const aliveA = atk.filter((u) => u.remaining > 0);
        const aliveD = def.filter((u) => u.remaining > 0);
        if (aliveA.length === 0 || aliveD.length === 0) break;
        rounds = round + 1;

        const beforeA = atk.map((u) => u.remaining);
        const beforeD = def.map((u) => u.remaining);

        // Angreifer → Verteidiger
        attackDamage += _dealRoundDamage(aliveA, def);
        // Verteidiger → Angreifer (gleichzeitig, Verluste dieser Runde zählen noch nicht)
        defenseDamage += _dealRoundDamage(aliveD, atk);

        _applyDamagePool(atk);
        _applyDamagePool(def);

        const aKilled = beforeA.reduce((s, b, i) => s + Math.max(0, b - atk[i].remaining), 0);
        const dKilled = beforeD.reduce((s, b, i) => s + Math.max(0, b - def[i].remaining), 0);
        const aAlive = atk.reduce((s, u) => s + u.remaining, 0);
        const dAlive = def.reduce((s, u) => s + u.remaining, 0);
        if (aKilled > 0 || dKilled > 0) {
            roundLog.push({ r: rounds, aKilled, dKilled, aAlive, dAlive });
        }
    }

    const attackerLossMap = new Map();
    for (let i = 0; i < atk.length; i++) {
        attackerLossMap.set(atk[i].id, Number(attackerUnits[i].quantity) - atk[i].remaining);
    }
    const defenderLossMap = new Map();
    for (let i = 0; i < def.length; i++) {
        defenderLossMap.set(def[i].id, Number(defenderUnits[i].quantity) - def[i].remaining);
    }

    return { attackerLosses: attackerLossMap, defenderLosses: defenderLossMap, attackDamage, defenseDamage, rounds, roundLog };
}

/**
 * Verteilt den Schaden einer Seite auf die lebenden Zieleinheiten (eine Runde).
 * Gibt den gesamten ausgeteilten Schaden zurück.
 */
function _dealRoundDamage(sourceUnits, allTargets) {
    const aliveTargets = allTargets.filter((u) => u.remaining > 0);
    if (aliveTargets.length === 0) return 0;

    let totalDealt = 0;
    for (const source of sourceUnits) {
        const healthFactor = Math.max(0, source.health_percentage) / 100;
        const baseDamage = source.remaining * source.attack_points * healthFactor;
        if (baseDamage <= 0) continue;

        const weighted = aliveTargets
            .map((t) => ({ t, w: getUnitMatchup(source.unit_name, t.unit_name) * t.remaining }))
            .filter((e) => e.w > 0);
        if (weighted.length === 0) continue;

        const totalW = weighted.reduce((s, e) => s + e.w, 0);
        for (const entry of weighted) {
            const share = baseDamage * (entry.w / totalW);
            entry.t.damagePool += share;
            totalDealt += share;
        }
    }
    return totalDealt;
}

/** Zieht aus dem Schadenspool Verluste ab und überträgt den Rest. */
function _applyDamagePool(units) {
    for (const u of units) {
        if (u.damagePool <= 0 || u.remaining <= 0) continue;
        const effHP = toEffectiveHitpoints(u);
        const losses = Math.min(u.remaining, Math.floor(u.damagePool / effHP));
        if (losses > 0) {
            u.remaining -= losses;
            u.damagePool -= losses * effHP;
            if (u.damagePool < 0) u.damagePool = 0;
        }
    }
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
        const attacksToday = await combatMissionsRepo.countAttacksByPairToday(attackerId, defenderId, client);
        if (attacksToday >= MAX_DAILY_ATTACKS_PER_TARGET) {
            throw createServiceError(
                'Maximal 6 Angriffe pro Tag auf den gleichen Spieler erlaubt',
                429,
                'ATTACK_LIMIT_REACHED'
            );
        }
        if (attacker.koordinate_x == null || defender.koordinate_x == null) {
            throw createServiceError('Spielerkoordinaten fehlen', 400, 'MISSING_COORDINATES');
        }

        // Einheiten validieren + Daten laden
        const unitRecords = [];
        for (const entry of units) {
            const userUnitId = entry.userUnitId ?? entry.user_unit_id;
            const unit = await unitsRepo.findMovableUnit(userUnitId, attackerId, client);
            if (!unit) throw createServiceError(`Einheit ${userUnitId} nicht gefunden oder gehört nicht dir`, 404, 'UNIT_NOT_FOUND');
            if (unit.category === 'defense') {
                throw createServiceError('Verteidigungsstellungen können nicht für Angriffe eingesetzt werden', 400, 'INVALID_UNIT_CATEGORY');
            }
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
        const fuelCost = calculateFuelCost(distance, unitRecords);

        const resources = (await resourcesRepo.findByUserIdLocked(attackerId, client)) ?? {
            treibstoff: 0,
        };
        if (Number(resources.treibstoff ?? 0) < fuelCost) {
            throw createServiceError('Nicht genug Treibstoff für den Angriff', 400, 'INSUFFICIENT_RESOURCES');
        }
        await resourcesRepo.deductResources(attackerId, 0, 0, 0, fuelCost, client);

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
            fuelCost,
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
 */
async function _resolveCombat(mission, client) {
    const missionUnits = await combatMissionsRepo.findMissionUnits(mission.id, client);
    const defenderUnits = await unitsRepo.findCombatUnitsByUser(mission.defender_id, client);

    const hasKampftaucher = missionUnits.some((u) => u.unit_name === 'Kampftaucher' && u.quantity_sent > 0);

    const activeAttackers = missionUnits.filter((u) => Number(u.quantity_sent) > 0);
    const activeDefenders = defenderUnits.filter((u) => Number(u.quantity) > 0);

    // Für die Verlustquote zählen alle vor Ort befindlichen Verteidiger inkl. Verteidigungsanlagen.
    const attackerCount = activeAttackers.reduce((sum, u) => sum + Number(u.quantity_sent || 0), 0);
    const defenderCount = activeDefenders.reduce((sum, u) => sum + Number(u.quantity || 0), 0);

    if (defenderCount === 0) {
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
        const plunderedBuildings = await _plunderBuildings(mission.attacker_id, mission.defender_id, 1, client);

        const combatResult = {
            attackerWon: true,
            attackPower: 0,
            defensePower: 0,
            attackerCasualtyRate: 0,
            defenderCasualtyRate: 1,
            kampftaucherUsed: hasKampftaucher,
            attackerUnits: attackerResults,
            defenderUnits: [],
            plunderedBuildings,
            resolvedAt: new Date().toISOString(),
        };

        await combatMissionsRepo.updateMissionAfterCombat(mission.id, 'traveling_back', combatResult, returnTime, client);

        const resultPayload = {
            missionId: mission.id,
            attackerWon: true,
            attackerUsername: mission.attacker_username,
            defenderUsername: mission.defender_username,
            returnTime: returnTime.toISOString(),
        };
        broadcastToUser(mission.attacker_id, 'combat_result', resultPayload);
        broadcastToUser(mission.defender_id, 'combat_result', resultPayload);
        return;
    }

    const attackerCombatUnits = activeAttackers.map((u) => ({
        id: u.id,
        unit_name: u.unit_name,
        quantity: Number(u.quantity_sent || 0),
        attack_points: Number(u.attack_points || 0),
        defense_points: Number(u.defense_points || 0),
        hitpoints: Number(u.hitpoints || 1),
        health_percentage: Number(u.health_percentage || 100),
    }));
    const defenderCombatUnits = activeDefenders.map((u) => ({
        id: u.id,
        unit_name: u.unit_name,
        quantity: Number(u.quantity || 0),
        attack_points: Number(u.attack_points || 0),
        defense_points: Number(u.defense_points || 0),
        hitpoints: Number(u.hitpoints || 1),
        health_percentage: Number(u.health_percentage || 100),
    }));

    // Rundenbasierte Simulation: Schaden akkumuliert sich bis Einheiten sterben.
    const { attackerLosses, defenderLosses, attackDamage, defenseDamage, rounds, roundLog } =
        simulateCombatRounds(attackerCombatUnits, defenderCombatUnits);

    const attackPower = parseFloat(attackDamage.toFixed(2));
    const defensePower = parseFloat(defenseDamage.toFixed(2));

    let totalDefenderLosses = 0;
    const defenderResults = [];
    for (const du of defenderUnits) {
        const quantity = Number(du.quantity || 0);
        const losses = Math.min(quantity, defenderLosses.get(du.id) ?? 0);
        const remaining = quantity - losses;

        await unitsRepo.setUserUnitQuantity(du.id, remaining, client);
        if (remaining === 0) await unitsRepo.setUnitHealth(du.id, 0, client);

        totalDefenderLosses += losses;
        defenderResults.push({ unitId: du.id, unitName: du.unit_name, losses, remaining });
    }

    let totalAttackerLosses = 0;
    const attackerResults = [];
    for (const mu of missionUnits) {
        const sent = Number(mu.quantity_sent || 0);
        const losses = Math.min(sent, attackerLosses.get(mu.id) ?? 0);
        const survived = sent - losses;

        totalAttackerLosses += losses;
        attackerResults.push({
            missionUnitId: mu.id,
            userUnitId: mu.user_unit_id,
            unitName: mu.unit_name,
            sent,
            survived,
            losses,
        });
        await combatMissionsRepo.setMissionUnitReturned(mu.id, survived, client);
    }

    const attackerCasualtyRate = attackerCount > 0 ? Math.min(1, totalAttackerLosses / attackerCount) : 1;
    const defenderCasualtyRate = defenderCount > 0 ? Math.min(1, totalDefenderLosses / defenderCount) : 1;
    const attackerSurvivors = attackerCount - totalAttackerLosses;
    const attackerWon = defenderCasualtyRate > attackerCasualtyRate && attackerSurvivors > 0;

    const returnSpeed = slowestSpeed(missionUnits.length > 0 ? missionUnits : [{ movement_speed: 1 }]);
    const returnTime = calcArrivalTime(mission.distance, returnSpeed);

    const plunderedBuildings = attackerWon
        ? await _plunderBuildings(mission.attacker_id, mission.defender_id, defenderCasualtyRate, client)
        : [];

    const combatResult = {
        attackerWon,
        rounds,
        roundLog,
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
