import pool from '../database/db.js';

// ─────────────────────────────────────────────────────────────────────────────
// CREATE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Legt eine neue Spionage-Mission an und gibt die vollständige Zeile zurück.
 */
export async function createMission(
    { spyId, targetId, originX, originY, targetX, targetY, distance, spiesSent, arrivalTime },
    client = pool
) {
    const res = await client.query(
        `INSERT INTO spy_missions
           (spy_id, target_id, origin_x, origin_y, target_x, target_y,
            distance, spies_sent, arrival_time)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [spyId, targetId, originX, originY, targetX, targetY, distance, spiesSent, arrivalTime]
    );
    return res.rows[0];
}

/**
 * Fügt die Einheitenzuordnung für eine Mission ein.
 */
export async function addMissionUnit(missionId, userUnitId, quantitySent, client = pool) {
    const res = await client.query(
        `INSERT INTO spy_mission_units (mission_id, user_unit_id, quantity_sent)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [missionId, userUnitId, quantitySent]
    );
    return res.rows[0];
}

// ─────────────────────────────────────────────────────────────────────────────
// READ
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Alle Missionen, die gerade beim Ziel ankommen (Tick-Abfrage).
 */
export async function findArrivingMissions(now, client = pool) {
    const res = await client.query(
        `SELECT sm.*,
                su.username AS spy_username,
                tu.username AS target_username,
                tu.koordinate_x AS target_kx,
                tu.koordinate_y AS target_ky
         FROM spy_missions sm
         JOIN users su ON su.id = sm.spy_id
         JOIN users tu ON tu.id = sm.target_id
         WHERE sm.status = 'traveling_to'
           AND sm.arrival_time <= $1`,
        [now]
    );
    return res.rows;
}

/**
 * Alle Missionen, deren Spione gerade zurückkehren (Tick-Abfrage).
 */
export async function findReturningMissions(now, client = pool) {
    const res = await client.query(
        `SELECT sm.*,
                su.username AS spy_username,
                tu.username AS target_username
         FROM spy_missions sm
         JOIN users su ON su.id = sm.spy_id
         JOIN users tu ON tu.id = sm.target_id
         WHERE sm.status = 'traveling_back'
           AND sm.return_time <= $1`,
        [now]
    );
    return res.rows;
}

/**
 * Einheitenzuordnungen für eine Mission.
 */
export async function findMissionUnits(missionId, client = pool) {
    const res = await client.query(
        `SELECT smu.*, ut.name, ut.movement_speed, ut.category
         FROM spy_mission_units smu
         JOIN user_units uu ON uu.id = smu.user_unit_id
         JOIN unit_types ut ON ut.id = uu.unit_type_id
         WHERE smu.mission_id = $1`,
        [missionId]
    );
    return res.rows;
}

/**
 * Aktive Missionen eines Spielers (als Spion).
 */
export async function findActiveMissionsBySpy(spyId, client = pool) {
    const res = await client.query(
        `SELECT sm.*,
                tu.username AS target_username,
                tu.koordinate_x AS target_kx,
                tu.koordinate_y AS target_ky
         FROM spy_missions sm
         JOIN users tu ON tu.id = sm.target_id
         WHERE sm.spy_id = $1
           AND sm.status IN ('traveling_to', 'traveling_back')
         ORDER BY sm.created_at DESC`,
        [spyId]
    );
    return res.rows;
}

/**
 * Alle abgeschlossenen Berichte eines Spielers (neueste zuerst).
 */
export async function findReportsByUser(userId, limit = 20, client = pool) {
    const res = await client.query(
        `SELECT sm.id, sm.created_at, sm.arrival_time, sm.spies_sent, sm.spies_returned,
                sm.report, sm.status,
                tu.username AS target_username
         FROM spy_missions sm
         JOIN users tu ON tu.id = sm.target_id
         WHERE sm.spy_id = $1
           AND sm.status IN ('completed', 'aborted')
         ORDER BY sm.created_at DESC
         LIMIT $2`,
        [userId, limit]
    );
    return res.rows;
}

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Status und Bericht nach Ankunft setzen (→ traveling_back oder aborted).
 */
export async function setMissionResult(missionId, status, report, returnTime, client = pool) {
    const res = await client.query(
        `UPDATE spy_missions
         SET status = $2, report = $3, return_time = $4
         WHERE id = $1 AND status = 'traveling_to'
         RETURNING *`,
        [missionId, status, JSON.stringify(report), returnTime]
    );
    return res.rows[0];
}

/**
 * Mission als abgeschlossen markieren + Anzahl zurückgekehrter Spione setzen.
 */
export async function completeMission(missionId, spiesReturned, client = pool) {
    const res = await client.query(
        `UPDATE spy_missions
         SET status = 'completed', spies_returned = $2
         WHERE id = $1 AND status = 'traveling_back'
         RETURNING *`,
        [missionId, spiesReturned]
    );
    return res.rows[0];
}

/**
 * Zurückgekehrte Menge für eine Einheitenzuordnung setzen.
 */
export async function setUnitQuantityReturned(missionId, userUnitId, quantityReturned, client = pool) {
    await client.query(
        `UPDATE spy_mission_units
         SET quantity_returned = $3
         WHERE mission_id = $1 AND user_unit_id = $2`,
        [missionId, userUnitId, quantityReturned]
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Geheimdienstzentrum-Level des Spielers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Gibt das höchste fertiggestellte Geheimdienstzentrum-Level zurück (0 = keines).
 */
export async function findIntelLevel(userId, client = pool) {
    const res = await client.query(
        `SELECT MAX(ub.level) AS max_level
         FROM user_buildings ub
         JOIN building_types bt ON bt.id = ub.building_type_id
         WHERE ub.user_id = $1
           AND bt.name LIKE 'Geheimdienstzentrum%'
           AND ub.is_constructing = FALSE`,
        [userId]
    );
    return Number(res.rows[0]?.max_level ?? 0);
}

/**
 * Gibt das höchste fertiggestellte Gegenspionage-Level zurück (0 = keines).
 */
export async function findCounterIntelLevel(userId, client = pool) {
    const res = await client.query(
        `SELECT MAX(ub.level) AS max_level
         FROM user_buildings ub
         JOIN building_types bt ON bt.id = ub.building_type_id
         WHERE ub.user_id = $1
           AND bt.name LIKE 'Gegenspionage%'
           AND ub.is_constructing = FALSE`,
        [userId]
    );
    return Number(res.rows[0]?.max_level ?? 0);
}

/**
 * Kurzfassung der Gebäude eines Spielers für den Spionage-Bericht.
 * Gibt Anzahl nach Kategorie zurück.
 */
export async function findBuildingSummaryForReport(userId, client = pool) {
    const res = await client.query(
        `SELECT bt.category, COUNT(*) AS count
         FROM user_buildings ub
         JOIN building_types bt ON bt.id = ub.building_type_id
         WHERE ub.user_id = $1
           AND ub.is_constructing = FALSE
         GROUP BY bt.category`,
        [userId]
    );
    const summary = {};
    for (const row of res.rows) {
        summary[row.category] = Number(row.count);
    }
    return summary;
}

/**
 * Einheitenübersicht für den Spionage-Bericht.
 */
export async function findUnitSummaryForReport(userId, client = pool) {
    const res = await client.query(
        `SELECT ut.name, ut.category, uu.quantity
         FROM user_units uu
         JOIN unit_types ut ON ut.id = uu.unit_type_id
         WHERE uu.user_id = $1 AND uu.quantity > 0`,
        [userId]
    );
    return res.rows;
}
