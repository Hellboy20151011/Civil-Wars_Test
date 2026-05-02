import pool from '../database/db.js';

// ── Gebäudetypen ──────────────────────────────────────────────────────────────

export async function findAllTypes(client = pool) {
    const result = await client.query('SELECT * FROM building_types ORDER BY id');
    return result.rows;
}

export async function findTypeById(id, client = pool) {
    const result = await client.query('SELECT * FROM building_types WHERE id = $1', [id]);
    return result.rows[0] ?? null;
}

export async function findTypeByName(name, client = pool) {
    const result = await client.query('SELECT * FROM building_types WHERE name = $1', [name]);
    return result.rows[0] ?? null;
}

// ── Gebäude des Spielers ──────────────────────────────────────────────────────

export async function findBuildingsByUser(userId, client = pool) {
    const result = await client.query(
        `SELECT bt.id, bt.name, bt.kategorie, bt.description,
                bt.money_production, bt.stone_production, bt.iron_production, bt.fuel_production,
                bt.power_production, bt.power_consumption, bt.population,
                ub.anzahl
         FROM user_buildings ub
         JOIN building_types bt ON bt.id = ub.building_type_id
         WHERE ub.user_id = $1
         ORDER BY bt.id`,
        [userId]
    );
    return result.rows;
}

export async function findBuildingCountByName(userId, name, client = pool) {
    const result = await client.query(
        `SELECT COALESCE(ub.anzahl, 0) AS anzahl
         FROM building_types bt
         LEFT JOIN user_buildings ub ON ub.building_type_id = bt.id AND ub.user_id = $1
         WHERE bt.name = $2`,
        [userId, name]
    );
    return Number(result.rows[0]?.anzahl ?? 0);
}

// Gebäude hinzufügen oder Anzahl erhöhen
export async function upsertBuilding(userId, buildingTypeId, anzahl = 1, client = pool) {
    await client.query(
        `INSERT INTO user_buildings (user_id, building_type_id, anzahl)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, building_type_id)
         DO UPDATE SET anzahl = user_buildings.anzahl + $3`,
        [userId, buildingTypeId, anzahl]
    );
}

// ── Bauwarteschlange ──────────────────────────────────────────────────────────

export async function findQueueByUser(userId, client = pool) {
    const result = await client.query(
        `SELECT ba.id, ba.building_type_id, ba.anzahl, ba.fertig_am, ba.erstellt_am,
                bt.name, bt.kategorie
         FROM bau_auftraege ba
         JOIN building_types bt ON bt.id = ba.building_type_id
         WHERE ba.user_id = $1
         ORDER BY ba.fertig_am`,
        [userId]
    );
    return result.rows;
}

export async function findExistingQueueEntry(userId, buildingTypeId, client = pool) {
    const result = await client.query(
        `SELECT id FROM bau_auftraege
         WHERE user_id = $1 AND building_type_id = $2 AND fertig_am > NOW()`,
        [userId, buildingTypeId]
    );
    return result.rows[0] ?? null;
}

export async function createQueueEntry(userId, buildingTypeId, anzahl, bauzeit_minuten, client = pool) {
    const result = await client.query(
        `INSERT INTO bau_auftraege (user_id, building_type_id, anzahl, fertig_am)
         VALUES ($1, $2, $3, NOW() + ($4 || ' minutes')::INTERVAL)
         RETURNING *`,
        [userId, buildingTypeId, anzahl, bauzeit_minuten]
    );
    return result.rows[0];
}

// Fertige Aufträge laden und einbuchen, dann löschen
export async function findFinishedQueueEntries(userId, client = pool) {
    const result = await client.query(
        `SELECT id, building_type_id, anzahl FROM bau_auftraege
         WHERE user_id = $1 AND fertig_am <= NOW()`,
        [userId]
    );
    return result.rows;
}

export async function deleteFinishedQueueEntries(userId, client = pool) {
    const result = await client.query(
        `DELETE FROM bau_auftraege
         WHERE user_id = $1 AND fertig_am <= NOW()
         RETURNING id`,
        [userId]
    );
    return result.rows;
}
