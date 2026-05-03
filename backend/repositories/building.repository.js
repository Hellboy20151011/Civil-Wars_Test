import pool from '../database/db.js';

const TICK_MS = process.env.NODE_ENV === 'production' ? 10 * 60 * 1000 : 60 * 1000;

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
        `SELECT bt.id,
                bt.name,
                bt.category,
                bt.category AS kategorie,
                bt.description,
                bt.money_production,
                bt.stone_production,
                bt.steel_production,
                bt.steel_production AS iron_production,
                bt.fuel_production,
                bt.power_production,
                bt.power_consumption,
                bt.population,
                COUNT(*)::INTEGER AS anzahl
         FROM user_buildings ub
         JOIN building_types bt ON bt.id = ub.building_type_id
         WHERE ub.user_id = $1
           AND ub.is_constructing = FALSE
         GROUP BY bt.id, bt.name, bt.category, bt.description,
                  bt.money_production, bt.stone_production, bt.steel_production,
                  bt.fuel_production, bt.power_production, bt.power_consumption, bt.population
         ORDER BY bt.id`,
        [userId]
    );
    return result.rows;
}

export async function findBuildingCountByName(userId, name, client = pool) {
    const result = await client.query(
        `SELECT COUNT(*)::INTEGER AS anzahl
         FROM user_buildings ub
         JOIN building_types bt ON bt.id = ub.building_type_id
         WHERE ub.user_id = $1
           AND ub.is_constructing = FALSE
           AND (bt.name = $2 OR bt.name ILIKE ($2 || ' Level %'))`,
        [userId, name]
    );
    return Number(result.rows[0]?.anzahl ?? 0);
}

// Gebäude hinzufügen oder Anzahl erhöhen
export async function upsertBuilding(userId, buildingTypeId, anzahl = 1, client = pool) {
    const count = Math.max(1, Number(anzahl || 1));
    for (let i = 0; i < count; i += 1) {
        await client.query(
            `INSERT INTO user_buildings (user_id, building_type_id, level, is_constructing)
             VALUES ($1, $2, 1, FALSE)`,
            [userId, buildingTypeId]
        );
    }
}

// ── Bauwarteschlange ──────────────────────────────────────────────────────────

export async function findQueueByUser(userId, client = pool) {
    const result = await client.query(
                `SELECT ub.id,
                                ub.building_type_id,
                                1 AS anzahl,
                                ub.construction_end_time AS fertig_am,
                                ub.construction_start_time AS erstellt_am,
                                bt.name,
                                bt.category,
                                bt.category AS kategorie
                 FROM user_buildings ub
                 JOIN building_types bt ON bt.id = ub.building_type_id
                 WHERE ub.user_id = $1
                     AND ub.is_constructing = TRUE
                 ORDER BY ub.construction_end_time`,
        [userId]
    );
    return result.rows;
}

export async function findExistingQueueEntry(userId, buildingTypeId, client = pool) {
    const result = await client.query(
        `SELECT id
         FROM user_buildings
         WHERE user_id = $1
           AND building_type_id = $2
           AND is_constructing = TRUE
           AND construction_end_time > NOW()`,
        [userId, buildingTypeId]
    );
    return result.rows[0] ?? null;
}

export async function createQueueEntry(userId, buildingTypeId, anzahl, bauzeit_ticks, client = pool) {
    const quantity = Math.max(1, Number(anzahl || 1));
    const ticks = Number(bauzeit_ticks || 0);
    const buildMs = Math.max(0, Math.round(ticks * TICK_MS));

    let first = null;
    for (let i = 0; i < quantity; i += 1) {
        const result = await client.query(
            `INSERT INTO user_buildings (
                user_id,
                building_type_id,
                level,
                is_constructing,
                construction_start_time,
                construction_end_time
            )
             VALUES ($1, $2, 1, TRUE, NOW(), NOW() + ($3 * INTERVAL '1 millisecond'))
             RETURNING id, user_id, building_type_id, construction_start_time AS erstellt_am, construction_end_time AS fertig_am`,
            [userId, buildingTypeId, buildMs]
        );
        if (!first) first = result.rows[0];
    }

    return {
        ...first,
        anzahl: quantity,
    };
}

// Fertige Aufträge laden und als gebaut markieren.
export async function findFinishedQueueEntries(userId, client = pool) {
    const result = await client.query(
        `SELECT id, building_type_id, 1 AS anzahl
         FROM user_buildings
         WHERE user_id = $1
           AND is_constructing = TRUE
           AND construction_end_time <= NOW()`,
        [userId]
    );
    return result.rows;
}

export async function deleteFinishedQueueEntries(userId, client = pool) {
    const result = await client.query(
        `UPDATE user_buildings
         SET is_constructing = FALSE,
             construction_start_time = NULL,
             construction_end_time = NULL,
             updated_at = NOW()
         WHERE user_id = $1
           AND is_constructing = TRUE
           AND construction_end_time <= NOW()
         RETURNING id`,
        [userId]
    );
    return result.rows;
}
