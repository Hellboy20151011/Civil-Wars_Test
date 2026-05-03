/**
 * Units Service - Handhabt Einheitenausbildung und Verwaltung
 */

import pool from '../database/db.js';
import { hasEnoughResources, deductResources } from './buildings.service.js';

// ─────────────────────────────────────────────────────────────────────────────
// GET: Einheiten abrufen
// ─────────────────────────────────────────────────────────────────────────────

export async function getUserUnits(userId) {
    const query = `
        SELECT 
            uu.id,
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
        ORDER BY ut.category, ut.name
    `;
    const result = await pool.query(query, [userId]);
    return result.rows;
}

export async function getUnitTypeByName(name) {
    const query = `SELECT * FROM unit_types WHERE name = $1`;
    const result = await pool.query(query, [name]);
    return result.rows[0] ?? null;
}

export async function getUnitById(unitTypeId) {
    const query = `SELECT * FROM unit_types WHERE id = $1`;
    const result = await pool.query(query, [unitTypeId]);
    return result.rows[0] ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// TRAIN: Einheiten ausbilden
// ─────────────────────────────────────────────────────────────────────────────

export async function startTraining(userId, unitTypeId, quantity = 1) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Einheitentyp abrufen
        const unitTypeResult = await client.query(
            'SELECT * FROM unit_types WHERE id = $1',
            [unitTypeId]
        );
        const unitType = unitTypeResult.rows[0];
        if (!unitType) throw new Error('Einheitentyp nicht gefunden');

        // 2. Prüfe Gebäude-Voraussetzung
        const hasBuilding = await client.query(
            `SELECT COUNT(*) as count FROM user_buildings ub
            JOIN building_types bt ON ub.building_type_id = bt.id
            WHERE ub.user_id = $1 AND bt.name = $2 AND ub.is_constructing = FALSE`,
            [userId, unitType.building_requirement]
        );
        
        if (Number(hasBuilding.rows[0].count) === 0) {
            throw new Error(`Gebäude '${unitType.building_requirement}' nicht gefunden oder noch in Konstruktion`);
        }

        // 3. Ressourcen prüfen (x Menge)
        const totalCosts = {
            money: unitType.money_cost * quantity,
            steel: unitType.steel_cost * quantity,
            fuel: unitType.fuel_cost * quantity
        };

        const hasResources = await hasEnoughResources(userId, totalCosts, client);
        if (!hasResources) throw new Error('Nicht genug Ressourcen für Ausbildung');

        // 4. Ressourcen abziehen
        await deductResources(userId, totalCosts, client);

        // 5. Einheiten zur Ausbildungswarteschlange hinzufügen oder existierende erhöhen
        const existingUnit = await client.query(
            `SELECT * FROM user_units WHERE user_id = $1 AND unit_type_id = $2`,
            [userId, unitTypeId]
        );

        if (existingUnit.rows.length > 0) {
            // Existierende Einheit: Menge erhöhen
            await client.query(
                `UPDATE user_units SET quantity = quantity + $1 WHERE user_id = $2 AND unit_type_id = $3`,
                [quantity, userId, unitTypeId]
            );
        } else {
            // Neue Einheit: Eintrag erstellen
            await client.query(
                `INSERT INTO user_units (user_id, unit_type_id, quantity, health_percentage)
                VALUES ($1, $2, $3, 100)`,
                [userId, unitTypeId, quantity]
            );
        }

        await client.query('COMMIT');
        return {
            success: true,
            unit: unitType.name,
            quantity,
            totalCost: totalCosts,
            trainingTime: unitType.training_time_ticks * quantity
        };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// MOVE: Einheiten bewegen
// ─────────────────────────────────────────────────────────────────────────────

export async function moveUnits(userId, userUnitId, destinationX, destinationY) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Einheit abrufen
        const unitResult = await client.query(
            `SELECT uu.*, ut.movement_speed FROM user_units uu
            JOIN unit_types ut ON uu.unit_type_id = ut.id
            WHERE uu.id = $1 AND uu.user_id = $2`,
            [userUnitId, userId]
        );

        const unit = unitResult.rows[0];
        if (!unit) throw new Error('Einheit nicht gefunden');

        // 2. Distanz berechnen
        const distance = Math.sqrt(
            Math.pow(destinationX - unit.location_x, 2) +
            Math.pow(destinationY - unit.location_y, 2)
        );

        // 3. Ankunftszeit berechnen (Ticks)
        const travelTime = distance / unit.movement_speed;
        const arrivalTime = new Date(Date.now() + travelTime * 60 * 1000); // Ticks zu ms

        // 4. Bewegung starten
        await client.query(
            `UPDATE user_units 
            SET is_moving = TRUE, destination_x = $1, destination_y = $2, arrival_time = $3
            WHERE id = $4`,
            [destinationX, destinationY, arrivalTime, userUnitId]
        );

        await client.query('COMMIT');
        return {
            success: true,
            distance,
            travelTime,
            arrivalTime
        };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// ARRIVAL: Einheiten am Ziel ankommen lassen
// ─────────────────────────────────────────────────────────────────────────────

export async function arriveAtDestination(userUnitId) {
    const query = `
        UPDATE user_units 
        SET is_moving = FALSE, 
            location_x = destination_x, 
            location_y = destination_y,
            destination_x = NULL,
            destination_y = NULL,
            arrival_time = NULL
        WHERE id = $1
    `;
    const result = await pool.query(query, [userUnitId]);
    return result.rows[0] ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// ATTACK: Einheiten angreifen (vereinfacht)
// ─────────────────────────────────────────────────────────────────────────────

export async function attackUnits(attackingUnitId, targetUnitId) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Beide Einheiten abrufen
        const [attackerResult, targetResult] = await Promise.all([
            client.query(
                `SELECT uu.*, ut.attack_points FROM user_units uu
                JOIN unit_types ut ON uu.unit_type_id = ut.id
                WHERE uu.id = $1`,
                [attackingUnitId]
            ),
            client.query(
                `SELECT uu.*, ut.defense_points, ut.hitpoints FROM user_units uu
                JOIN unit_types ut ON uu.unit_type_id = ut.id
                WHERE uu.id = $1`,
                [targetUnitId]
            )
        ]);

        const attacker = attackerResult.rows[0];
        const target = targetResult.rows[0];

        if (!attacker || !target) throw new Error('Einheit nicht gefunden');

        // 2. Schaden berechnen (vereinfacht: Angriff - Verteidigung)
        const baseDamage = attacker.attack_points;
        const defenseReduction = target.defense_points * 0.5; // 50% Schadensreduktion
        const actualDamage = Math.max(1, baseDamage - defenseReduction);

        // 3. Gesundheit reduzieren
        const healthLoss = (actualDamage / target.hitpoints) * 100;
        const newHealth = Math.max(0, target.health_percentage - healthLoss);

        await client.query(
            `UPDATE user_units SET health_percentage = $1 WHERE id = $2`,
            [newHealth, targetUnitId]
        );

        // 4. Wenn tot, Einheit entfernen oder auf 0 setzen
        if (newHealth <= 0) {
            await client.query(
                `UPDATE user_units SET quantity = 0 WHERE id = $1`,
                [targetUnitId]
            );
        }

        // 5. Erfahrung für Angreifer
        await client.query(
            `UPDATE user_units SET experience_points = experience_points + 10 WHERE id = $1`,
            [attackingUnitId]
        );

        await client.query('COMMIT');
        return {
            success: true,
            baseDamage,
            actualDamage,
            targetHealth: newHealth,
            targetDestroyed: newHealth <= 0
        };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Unit Types auflisten
// ─────────────────────────────────────────────────────────────────────────────

export async function getAllUnitTypes() {
    const query = `SELECT * FROM unit_types ORDER BY category, name`;
    const result = await pool.query(query);
    return result.rows;
}

export async function getUnitsByCategory(category) {
    const query = `SELECT * FROM unit_types WHERE category = $1 ORDER BY name`;
    const result = await pool.query(query, [category]);
    return result.rows;
}
