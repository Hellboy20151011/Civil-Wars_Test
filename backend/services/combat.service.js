/**
 * Combat Service – distanzbasierte Kampf-Missionen zwischen Spielern
 *
 * Ablauf:
 *   1. launchAttack()        – Spieler entsendet Einheiten → Mission wird angelegt, Einheiten reserviert
 *   2. processArrivingMissions()  – Tick-System: Einheiten kommen an → Kampf wird berechnet,
 *                                   Verluste gespeichert, Rückreise gestartet
 *   3. processReturningMissions() – Tick-System: Einheiten sind zurück → Mengen angepasst, Mission abgeschlossen
 */

import * as combatMissionsRepo from '../repositories/combat-missions.repository.js';
import * as playerRepo from '../repositories/player.repository.js';
import * as unitsRepo from '../repositories/units.repository.js';
import { withTransaction } from '../repositories/transaction.repository.js';
import { broadcastToUser } from './live-updates.service.js';
import { config } from '../config.js';
import { logger } from '../logger.js';
import { createServiceError } from './service-error.js';

// ─────────────────────────────────────────────────────────────────────────────
// KAMPF-MATCHUP-TABELLE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Welche Kategorie kann welche angreifen und mit welchem Multiplikator?
 * 0 = Angriff nicht möglich (hartes System).
 *
 *  infantry → infantry 1.0 | vehicle 0.5 | defense 0.6
 *  vehicle  → infantry 1.2 | vehicle 1.0 | defense 0.9
 *  ship     → infantry 0.8 | ship    1.0 | defense 1.0
 *  air      → infantry 1.5 | vehicle 1.2 | ship 1.0 | air 1.0 | defense 1.0
 *  defense  → passiv (greift nie an)
 *
 * Sonderregeln (per unit_name):
 *  - Fregatte      → kann auch Luft angreifen (0.8)
 *  - Panzergrenadier → vehicle bekommt 0.8 statt 0.5
 *  - Kampftaucher    → vehicle bekommt 0.8 statt 0.5;
 *                      PLUS Vorbereitungsphase: neutralisiert alle defense-Einheiten des Gegners
 */
const MATCHUP = {
    infantry: { infantry: 1.0, vehicle: 0.5, defense: 0.6 },
    vehicle:  { infantry: 1.2, vehicle: 1.0, defense: 0.9 },
    ship:     { infantry: 0.8, ship:    1.0, defense: 1.0 },
    air:      { infantry: 1.5, vehicle: 1.2, ship: 1.0, air: 1.0, defense: 1.0 },
    defense:  {}, // passiv
};

/**
 * Gibt den Matchup-Multiplikator zurück.
 * @param {string} attackerCategory
 * @param {string|null} attackerUnitName  – null erlaubt (keine Sonderregel)
 * @param {string} defenderCategory
 * @returns {number} 0 = Angriff nicht möglich
 */
function getMatchup(attackerCategory, attackerUnitName, defenderCategory) {
    // Sonderfall: Fregatte greift auch Luft an
    if (attackerUnitName === 'Fregatte' && defenderCategory === 'air') return 0.8;

    const base = MATCHUP[attackerCategory]?.[defenderCategory] ?? 0;
    if (base === 0) return 0;

    // Sonderfall: Panzergrenadier + Kampftaucher sind besser gegen Fahrzeuge
    if (
        (attackerUnitName === 'Panzergrenadier' || attackerUnitName === 'Kampftaucher') &&
        defenderCategory === 'vehicle'
    ) {
        return 0.8;
    }

    return base;
}

// ─────────────────────────────────────────────────────────────────────────────
// HILFSFUNKTIONEN
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Euklidische Distanz zwischen zwei Koordinaten (in Gittereinheiten).
 */
function calcDistance(x1, y1, x2, y2) {
    return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
}

/**
 * Langsamste Einheit einer Liste bestimmt die Bewegungsgeschwindigkeit des Verbands.
 * @param {Array<{ movement_speed: number }>} unitTypes
 * @returns {number} Felder pro Tick
 */
function slowestSpeed(unitTypes) {
    return Math.min(...unitTypes.map((u) => Number(u.movement_speed)));
}

/**
 * Ankunftszeit aus Distanz und Geschwindigkeit berechnen.
 * Formel: travelTicks = distance / speed  → ms = travelTicks * tickIntervalMs
 */
function calcArrivalTime(distance, speed) {
    const travelTicks = distance / speed;
    const tickMs = config.gameloop.tickIntervalMs;
    return new Date(Date.now() + travelTicks * tickMs);
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
            const unit = await unitsRepo.findMovableUnit(entry.userUnitId, attackerId, client);
            if (!unit) throw createServiceError(`Einheit ${entry.userUnitId} nicht gefunden oder gehört nicht dir`, 404, 'UNIT_NOT_FOUND');
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

    // ── Phase 2: Effektive Angriffskraft (Matchup-gewichtet) ─────────────────
    // Alle Verteidiger-Kategorien die noch Einheiten haben
    const activeDefs = defenderUnits.filter((u) => u.quantity > 0);
    const defCats = [...new Set(activeDefs.map((u) => u.category))];

    const attackerCats = [...new Set(missionUnits.map((u) => u.category))];

    let attackPower = 0;
    for (const u of missionUnits) {
        if (!u.quantity_sent) continue;

        // Welche Defender-Kategorien kann diese Einheit angreifen?
        const reachable = defCats.filter((cat) => getMatchup(u.category, u.unit_name, cat) > 0);
        if (reachable.length === 0) continue; // Kann niemanden treffen → kein Beitrag

        // Durchschnitts-Multiplikator über alle erreichbaren Kategorien
        const avgMult =
            reachable.reduce((sum, cat) => sum + getMatchup(u.category, u.unit_name, cat), 0) /
            reachable.length;

        // Counter-Bonus: +30 % wenn diese Einheit eine ihrer Konter-Einheiten bekämpft
        const counterBonus = u.counter_unit &&
            activeDefs.some((d) => d.unit_name === u.counter_unit)
            ? 1.3
            : 1.0;

        attackPower +=
            u.attack_points * u.quantity_sent * (u.health_percentage / 100) * avgMult * counterBonus;
    }

    // ── Phase 3: Effektive Verteidigungskraft ─────────────────────────────────
    // Nur Einheiten zählen, die von mindestens einem Angreifer getroffen werden können
    let defensePower = 0;
    for (const u of activeDefs) {
        const canBeHit = attackerCats.some((cat) => getMatchup(cat, null, u.category) > 0);
        if (!canBeHit) continue; // Immun (z.B. Hubschrauber gegen reine Infanterie)
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
        attackerResults.push({ missionUnitId: mu.id, userUnitId: mu.user_unit_id, survived, unitName: mu.unit_name });
        await combatMissionsRepo.setMissionUnitReturned(mu.id, survived, client);
    }

    // ── Verluste Verteidiger ──────────────────────────────────────────────────
    // Nur Einheiten die angreifbar waren bekommen Verluste; immune bleiben unberührt
    const defenderResults = [];
    for (const du of defenderUnits) {
        const canBeHit = attackerCats.some((cat) => getMatchup(cat, null, du.category) > 0);
        const losses = canBeHit ? Math.floor(du.quantity * defenderCasualtyRate) : 0;
        const remaining = du.quantity - losses;
        await unitsRepo.setUserUnitQuantity(du.id, remaining, client);
        if (remaining === 0) await unitsRepo.setUnitHealth(du.id, 0, client);
        defenderResults.push({ unitId: du.id, unitName: du.unit_name, losses, remaining });
    }

    // ── Rückreise-Zeit ────────────────────────────────────────────────────────
    const returnSpeed = slowestSpeed(missionUnits.length > 0 ? missionUnits : [{ movement_speed: 1 }]);
    const returnTime = calcArrivalTime(mission.distance, returnSpeed);

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
