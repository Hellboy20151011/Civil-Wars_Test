import pool from '../database/db.js';

// ─────────────────────────────────────────────────────────────────────────────
// ERSTELLEN
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Legt eine neue Kampf-Mission an.
 * @returns {Promise<{ id: number, arrival_time: Date }>}
 */
export async function createMission(
    attackerId,
    defenderId,
    originX,
    originY,
    targetX,
    targetY,
    distance,
    arrivalTime,
    client = pool
) {
    const result = await client.query(
        `INSERT INTO combat_missions
            (attacker_id, defender_id, origin_x, origin_y, target_x, target_y, distance, arrival_time)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, arrival_time`,
        [attackerId, defenderId, originX, originY, targetX, targetY, distance, arrivalTime]
    );
    return result.rows[0];
}

/**
 * Anzahl der heute gestarteten Angriffe eines Angreifers auf einen bestimmten Verteidiger.
 */
export async function countAttacksByPairToday(attackerId, defenderId, client = pool) {
    const result = await client.query(
        `SELECT COUNT(*)::INTEGER AS count
         FROM combat_missions
         WHERE attacker_id = $1
           AND defender_id = $2
           AND created_at >= date_trunc('day', NOW())
           AND created_at < date_trunc('day', NOW()) + INTERVAL '1 day'`,
        [attackerId, defenderId]
    );

    return Number(result.rows[0]?.count ?? 0);
}

/**
 * Fügt eine Einheit zu einer Mission hinzu.
 */
export async function addMissionUnit(missionId, userUnitId, quantitySent, client = pool) {
    await client.query(
        `INSERT INTO combat_mission_units (mission_id, user_unit_id, quantity_sent)
         VALUES ($1, $2, $3)`,
        [missionId, userUnitId, quantitySent]
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// TICK-SYSTEM: Fällige Missionen abrufen
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Gibt alle Missionen zurück, die ihr Ziel erreicht haben (status = 'traveling_to' und arrival_time <= NOW()).
 * Wird vom Tick-System abgerufen, um den Kampf auszulösen.
 */
export async function findArrivingMissions(client = pool) {
    const result = await client.query(
        `SELECT cm.*,
                a.username AS attacker_username, a.koordinate_x AS attacker_x, a.koordinate_y AS attacker_y,
                d.username AS defender_username, d.koordinate_x AS defender_x, d.koordinate_y AS defender_y
         FROM combat_missions cm
         JOIN users a ON a.id = cm.attacker_id
         JOIN users d ON d.id = cm.defender_id
         WHERE cm.status = 'traveling_to'
           AND cm.arrival_time <= NOW()`
    );
    return result.rows;
}

/**
 * Gibt alle Missionen zurück, deren Einheiten zur Heimatbasis zurückgekehrt sind
 * (status = 'traveling_back' und return_time <= NOW()).
 */
export async function findReturningMissions(client = pool) {
    const result = await client.query(
        `SELECT * FROM combat_missions
         WHERE status = 'traveling_back'
           AND return_time <= NOW()`
    );
    return result.rows;
}

// ─────────────────────────────────────────────────────────────────────────────
// EINHEITEN EINER MISSION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Gibt alle Einheiten einer Mission mit ihren Typen zurück.
 */
export async function findMissionUnits(missionId, client = pool) {
    const result = await client.query(
        `SELECT cmu.id, cmu.user_unit_id, cmu.quantity_sent, cmu.quantity_returned,
                uu.unit_type_id, uu.health_percentage,
                ut.name AS unit_name, ut.category, ut.counter_unit,
                ut.attack_points, ut.defense_points,
                ut.hitpoints, ut.movement_speed
         FROM combat_mission_units cmu
         JOIN user_units uu ON uu.id = cmu.user_unit_id
         JOIN unit_types ut ON ut.id = uu.unit_type_id
         WHERE cmu.mission_id = $1`,
        [missionId]
    );
    return result.rows;
}

// ─────────────────────────────────────────────────────────────────────────────
// STATUS-UPDATES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Setzt Status, Ergebnis und Rückkehrzeit nach dem Kampf.
 * @param {number} missionId
 * @param {'traveling_back'|'completed'|'aborted'} status
 * @param {object|null} result - Kampfergebnis als JSON
 * @param {Date|null} returnTime - Ankunftszeit zuhause (null bei 'completed'/'aborted')
 */
export async function updateMissionAfterCombat(missionId, status, result, returnTime, client = pool) {
    await client.query(
        `UPDATE combat_missions
         SET status = $1, result = $2, return_time = $3
         WHERE id = $4`,
        [status, result ? JSON.stringify(result) : null, returnTime, missionId]
    );
}

/**
 * Schließt eine Rückkehr-Mission ab und setzt status = 'completed'.
 */
export async function completeMission(missionId, client = pool) {
    await client.query(
        `UPDATE combat_missions SET status = 'completed' WHERE id = $1`,
        [missionId]
    );
}

/**
 * Speichert die zurückgekehrte Menge pro Einheit nach dem Kampf.
 */
export async function setMissionUnitReturned(missionUnitId, quantityReturned, client = pool) {
    await client.query(
        `UPDATE combat_mission_units SET quantity_returned = $1 WHERE id = $2`,
        [quantityReturned, missionUnitId]
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// SPIELER-ABFRAGEN
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Alle laufenden Missionen eines Angreifers (für Dashboard/Status).
 */
export async function findActiveMissionsByAttacker(userId, client = pool) {
    const result = await client.query(
        `SELECT cm.id, cm.status, cm.distance, cm.arrival_time, cm.return_time, cm.result,
                cm.target_x, cm.target_y,
                d.username AS defender_username
         FROM combat_missions cm
         JOIN users d ON d.id = cm.defender_id
         WHERE cm.attacker_id = $1
           AND cm.status NOT IN ('completed', 'aborted')
         ORDER BY cm.arrival_time ASC`,
        [userId]
    );
    return result.rows;
}

/**
 * Alle eingehenden Angriffe auf einen Verteidiger (für Dashboard/Warnung).
 */
export async function findIncomingMissionsByDefender(userId, client = pool) {
    const result = await client.query(
        `SELECT cm.id, cm.status, cm.distance, cm.arrival_time,
                cm.origin_x, cm.origin_y,
                a.username AS attacker_username
         FROM combat_missions cm
         JOIN users a ON a.id = cm.attacker_id
         WHERE cm.defender_id = $1
           AND cm.status = 'traveling_to'
         ORDER BY cm.arrival_time ASC`,
        [userId]
    );
    return result.rows;
}

/**
 * Kampfhistorie eines Spielers (als Angreifer oder Verteidiger), neueste zuerst.
 */
export async function findMissionHistory(userId, limit = 20, client = pool) {
    const result = await client.query(
        `SELECT cm.id, cm.status, cm.distance, cm.arrival_time, cm.return_time, cm.result,
                cm.attacker_id, cm.defender_id,
                a.username AS attacker_username,
                d.username AS defender_username
         FROM combat_missions cm
         JOIN users a ON a.id = cm.attacker_id
         JOIN users d ON d.id = cm.defender_id
         WHERE (cm.attacker_id = $1 OR cm.defender_id = $1)
           AND cm.status IN ('traveling_back', 'completed')
         ORDER BY cm.arrival_time DESC
         LIMIT $2`,
        [userId, limit]
    );
    return result.rows;
}

/**
 * Einzelnen Kampfbericht fuer einen Spieler laden.
 * Zugriff nur wenn Spieler Angreifer oder Verteidiger der Mission war.
 */
export async function findMissionHistoryEntry(userId, missionId, client = pool) {
    const result = await client.query(
        `SELECT cm.id, cm.status, cm.distance, cm.arrival_time, cm.return_time, cm.result,
                cm.attacker_id, cm.defender_id,
                a.username AS attacker_username,
                d.username AS defender_username
         FROM combat_missions cm
         JOIN users a ON a.id = cm.attacker_id
         JOIN users d ON d.id = cm.defender_id
         WHERE cm.id = $1
           AND (cm.attacker_id = $2 OR cm.defender_id = $2)
           AND cm.status IN ('traveling_back', 'completed')`,
        [missionId, userId]
    );
    return result.rows[0] ?? null;
}
