import pool from '../database/db.js';
import * as referenceDataRepo from './reference-data.repository.js';

export async function findDetailedByUser(userId, client = pool) {
    const result = await client.query(
        `SELECT uu.id,
                uu.quantity,
                uu.health_percentage,
                uu.experience_points,
                uu.location_x,
                uu.location_y,
                uu.is_moving,
                uu.destination_x,
                uu.destination_y,
                uu.arrival_time,
                ut.name,
                ut.category,
                ut.description,
                ut.money_cost,
                ut.steel_cost,
                ut.fuel_cost,
                ut.training_time_ticks,
                ut.hitpoints,
                ut.attack_points,
                ut.defense_points,
                ut.movement_speed,
                ut.special_ability
         FROM user_units uu
         JOIN unit_types ut ON uu.unit_type_id = ut.id
         WHERE uu.user_id = $1
         ORDER BY ut.category,
                  (REGEXP_REPLACE(ut.building_requirement, '[^0-9]', '', 'g'))::INTEGER NULLS LAST,
                  ut.name`,
        [userId]
    );

    return result.rows;
}

export async function findTypeByName(name, client = pool) {
    const types = await referenceDataRepo.getUnitTypes(client);
    return types.find((entry) => entry.name === name) ?? null;
}

export async function findTypeById(unitTypeId, client = pool) {
    const types = await referenceDataRepo.getUnitTypes(client);
    return types.find((entry) => Number(entry.id) === Number(unitTypeId)) ?? null;
}

export async function findReadyBuildingCountByName(userId, buildingName, client = pool) {
    const result = await client.query(
        `SELECT COUNT(*) AS count
         FROM user_buildings ub
         JOIN building_types bt ON ub.building_type_id = bt.id
         WHERE ub.user_id = $1 AND bt.name = $2 AND ub.is_constructing = FALSE`,
        [userId, buildingName]
    );

    return Number(result.rows[0]?.count ?? 0);
}

export async function findUserUnitByType(userId, unitTypeId, client = pool) {
    const result = await client.query(
        'SELECT * FROM user_units WHERE user_id = $1 AND unit_type_id = $2',
        [userId, unitTypeId]
    );

    return result.rows[0] ?? null;
}

export async function incrementUserUnitQuantity(userId, unitTypeId, quantity, client = pool) {
    await client.query(
        'UPDATE user_units SET quantity = quantity + $1 WHERE user_id = $2 AND unit_type_id = $3',
        [quantity, userId, unitTypeId]
    );
}

export async function createUserUnit(userId, unitTypeId, quantity, client = pool) {
    await client.query(
        `INSERT INTO user_units (user_id, unit_type_id, quantity, health_percentage)
         VALUES ($1, $2, $3, 100)`,
        [userId, unitTypeId, quantity]
    );
}

export async function findMovableUnit(userUnitId, userId, client = pool) {
    const result = await client.query(
        `SELECT uu.*, ut.movement_speed
         FROM user_units uu
         JOIN unit_types ut ON uu.unit_type_id = ut.id
         WHERE uu.id = $1 AND uu.user_id = $2`,
        [userUnitId, userId]
    );

    return result.rows[0] ?? null;
}

export async function setUnitMovement(userUnitId, destinationX, destinationY, arrivalTime, client = pool) {
    await client.query(
        `UPDATE user_units
         SET is_moving = TRUE,
             destination_x = $1,
             destination_y = $2,
             arrival_time = $3
         WHERE id = $4`,
        [destinationX, destinationY, arrivalTime, userUnitId]
    );
}

export async function arriveAtDestination(userUnitId, client = pool) {
    const result = await client.query(
        `UPDATE user_units
         SET is_moving = FALSE,
             location_x = destination_x,
             location_y = destination_y,
             destination_x = NULL,
             destination_y = NULL,
             arrival_time = NULL
         WHERE id = $1
         RETURNING *`,
        [userUnitId]
    );

    return result.rows[0] ?? null;
}

export async function arriveDueUnitsByUser(userId, atTime, client = pool) {
    const result = await client.query(
        `UPDATE user_units
         SET is_moving = FALSE,
             location_x = destination_x,
             location_y = destination_y,
             destination_x = NULL,
             destination_y = NULL,
             arrival_time = NULL
         WHERE user_id = $1
           AND is_moving = TRUE
           AND arrival_time <= $2
         RETURNING id`,
        [userId, atTime]
    );

    return result.rows.length;
}

export async function findAttackerUnit(attackingUnitId, client = pool) {
    const result = await client.query(
        `SELECT uu.*, ut.attack_points
         FROM user_units uu
         JOIN unit_types ut ON uu.unit_type_id = ut.id
         WHERE uu.id = $1`,
        [attackingUnitId]
    );

    return result.rows[0] ?? null;
}

export async function findDefenderUnit(targetUnitId, client = pool) {
    const result = await client.query(
        `SELECT uu.*, ut.defense_points, ut.hitpoints
         FROM user_units uu
         JOIN unit_types ut ON uu.unit_type_id = ut.id
         WHERE uu.id = $1`,
        [targetUnitId]
    );

    return result.rows[0] ?? null;
}

export async function updateUnitHealth(unitId, healthPercentage, client = pool) {
    await client.query('UPDATE user_units SET health_percentage = $1 WHERE id = $2', [
        healthPercentage,
        unitId,
    ]);
}

export async function zeroUnitQuantity(unitId, client = pool) {
    await client.query('UPDATE user_units SET quantity = 0 WHERE id = $1', [unitId]);
}

export async function addUnitExperience(unitId, amount, client = pool) {
    await client.query('UPDATE user_units SET experience_points = experience_points + $1 WHERE id = $2', [
        amount,
        unitId,
    ]);
}

export async function findAllTypes(client = pool) {
    return referenceDataRepo.getUnitTypes(client);
}

export async function findTypesByCategory(category, client = pool) {
    const types = await referenceDataRepo.getUnitTypes(client);
    return types.filter((entry) => entry.category === category);
}
