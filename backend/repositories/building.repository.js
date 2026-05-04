import pool from '../database/db.js';
import { config } from '../config.js';
import * as referenceDataRepo from './reference-data.repository.js';

const TICK_MS = config.gameloop.tickIntervalMs;

// ── Gebäudetypen ──────────────────────────────────────────────────────────────

export async function findAllTypes(client = pool) {
    return referenceDataRepo.getBuildingTypes(client);
}

export async function findTypeById(id, client = pool) {
    const types = await referenceDataRepo.getBuildingTypes(client);
    return types.find((entry) => Number(entry.id) === Number(id)) ?? null;
}

export async function findTypeByName(name, client = pool) {
    const types = await referenceDataRepo.getBuildingTypes(client);
    return types.find((entry) => entry.name === name) ?? null;
}

export async function findDetailedByUser(userId, client = pool) {
    const result = await client.query(
        `SELECT ub.id,
                ub.level,
                ub.is_constructing,
                ub.construction_start_time,
                ub.construction_end_time,
                ub.location_x,
                ub.location_y,
                bt.name,
                bt.category,
                bt.description,
                bt.money_cost,
                bt.stone_cost,
                bt.steel_cost,
                bt.fuel_cost,
                bt.money_production,
                bt.stone_production,
                bt.steel_production,
                bt.fuel_production,
                bt.power_consumption,
                bt.power_production,
                bt.population,
                bt.build_time_ticks
         FROM user_buildings ub
         JOIN building_types bt ON ub.building_type_id = bt.id
         WHERE ub.user_id = $1
         ORDER BY bt.category, bt.name`,
        [userId]
    );
    return result.rows;
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
    await client.query(
        `INSERT INTO user_buildings (user_id, building_type_id, level, is_constructing)
         SELECT $1, $2, 1, FALSE
         FROM generate_series(1, $3)`,
        [userId, buildingTypeId, count]
    );
}

export async function createReadyBuildingAtLocation(
    userId,
    buildingTypeId,
    locationX,
    locationY,
    client = pool
) {
    await client.query(
        `INSERT INTO user_buildings
         (user_id, building_type_id, level, is_constructing, location_x, location_y)
         VALUES ($1, $2, 1, FALSE, $3, $4)`,
        [userId, buildingTypeId, locationX, locationY]
    );
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

export async function createConstructingBuilding(
    userId,
    buildingTypeId,
    constructionStartTime,
    constructionEndTime,
    locationX,
    locationY,
    client = pool
) {
    const result = await client.query(
        `INSERT INTO user_buildings
            (user_id, building_type_id, level, is_constructing, construction_start_time, construction_end_time, location_x, location_y)
         VALUES ($1, $2, 1, TRUE, $3, $4, $5, $6)
         RETURNING *`,
        [userId, buildingTypeId, constructionStartTime, constructionEndTime, locationX, locationY]
    );

    return result.rows[0] ?? null;
}

export async function findUserBuildingWithType(userBuildingId, userId, client = pool) {
    const result = await client.query(
        `SELECT ub.*, bt.*
         FROM user_buildings ub
         JOIN building_types bt ON ub.building_type_id = bt.id
         WHERE ub.id = $1 AND ub.user_id = $2`,
        [userBuildingId, userId]
    );
    return result.rows[0] ?? null;
}

export async function markUpgradeStarted(userBuildingId, constructionStartTime, constructionEndTime, client = pool) {
    await client.query(
        `UPDATE user_buildings
         SET level = level + 1,
             is_constructing = TRUE,
             construction_start_time = $1,
             construction_end_time = $2
         WHERE id = $3`,
        [constructionStartTime, constructionEndTime, userBuildingId]
    );
}

export async function findPowerSummaryByUser(userId, client = pool) {
    const result = await client.query(
        `SELECT COALESCE(SUM(CASE WHEN bt.power_production > 0 THEN bt.power_production ELSE 0 END), 0) AS production,
                COALESCE(SUM(CASE WHEN bt.power_consumption > 0 THEN bt.power_consumption ELSE 0 END), 0) AS consumption
         FROM user_buildings ub
         JOIN building_types bt ON ub.building_type_id = bt.id
         WHERE ub.user_id = $1 AND ub.is_constructing = FALSE`,
        [userId]
    );

    return result.rows[0] ?? { production: 0, consumption: 0 };
}

export async function createQueueEntry(
    userId,
    buildingTypeId,
    anzahl,
    bauzeit_ticks,
    client = pool
) {
    const quantity = Math.max(1, Number(anzahl || 1));
    const ticks = Number(bauzeit_ticks || 0);
    const buildMs = Math.max(0, Math.round(ticks * TICK_MS));

    const result = await client.query(
        `INSERT INTO user_buildings (
            user_id,
            building_type_id,
            level,
            is_constructing,
            construction_start_time,
            construction_end_time
        )
         SELECT $1, $2, 1, TRUE, NOW(), NOW() + ($3 * INTERVAL '1 millisecond')
         FROM generate_series(1, $4)
         RETURNING id, user_id, building_type_id, construction_start_time AS erstellt_am, construction_end_time AS fertig_am`,
        [userId, buildingTypeId, buildMs, quantity]
    );

    const first = result.rows[0] ?? null;

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
