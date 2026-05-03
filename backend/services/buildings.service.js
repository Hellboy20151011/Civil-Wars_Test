/**
 * Buildings Service - Handhabt Gebäudebau, Upgrades und Ressourcenprüfung
 * Tick-System: 1 Tick = 10 Min (Production) / 1 Min (Dev)
 */

import pool from '../database/db.js';

// ─────────────────────────────────────────────────────────────────────────────
// GET: Gebäude abrufen
// ─────────────────────────────────────────────────────────────────────────────

export async function getUserBuildings(userId) {
    const query = `
        SELECT 
            ub.id,
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
        ORDER BY bt.category, bt.name
    `;
    const result = await pool.query(query, [userId]);
    return result.rows;
}

export async function getBuildingById(buildingId) {
    const query = `SELECT * FROM building_types WHERE id = $1`;
    const result = await pool.query(query, [buildingId]);
    return result.rows[0] ?? null;
}

export async function getBuildingByName(name) {
    const query = `SELECT * FROM building_types WHERE name = $1`;
    const result = await pool.query(query, [name]);
    return result.rows[0] ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// BUILD: Gebäude bauen
// ─────────────────────────────────────────────────────────────────────────────

export async function startBuildingConstruction(userId, buildingTypeId, locationX, locationY) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Gebäudetyp abrufen
        const buildingType = await client.query('SELECT * FROM building_types WHERE id = $1', [
            buildingTypeId,
        ]);
        const building = buildingType.rows[0];
        if (!building) throw new Error('Gebäudetyp nicht gefunden');

        // 2. Ressourcen prüfen
        const hasResources = await hasEnoughResources(
            userId,
            {
                money: building.money_cost,
                stone: building.stone_cost,
                steel: building.steel_cost,
                fuel: building.fuel_cost,
            },
            client
        );
        if (!hasResources) throw new Error('Nicht genug Ressourcen');

        // 3. Strom prüfen (nur wenn Gebäude Strom verbraucht)
        if (building.power_consumption > 0) {
            const hasPower = await checkPowerAvailable(userId, building.power_consumption, client);
            if (!hasPower) throw new Error('Nicht genug Strom verfügbar');
        }

        // 4. Ressourcen abziehen
        await deductResources(
            userId,
            {
                money: building.money_cost,
                stone: building.stone_cost,
                steel: building.steel_cost,
                fuel: building.fuel_cost,
            },
            client
        );

        // 5. Gebäude in Konstruktion setzen
        const now = new Date();
        const constructionEndTime = new Date(now.getTime() + building.build_time_ticks * 60 * 1000); // Ticks zu Millisekunden

        const result = await client.query(
            `INSERT INTO user_buildings 
            (user_id, building_type_id, level, is_constructing, construction_start_time, construction_end_time, location_x, location_y)
            VALUES ($1, $2, 1, TRUE, $3, $4, $5, $6)
            RETURNING *`,
            [userId, buildingTypeId, now, constructionEndTime, locationX, locationY]
        );

        await client.query('COMMIT');
        return {
            success: true,
            building: result.rows[0],
            estimatedTime: building.build_time_ticks,
        };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// UPGRADE: Gebäude upgraden
// ─────────────────────────────────────────────────────────────────────────────

export async function startUpgrade(userId, userBuildingId) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Spielergebäude abrufen
        const userBuildingResult = await client.query(
            `SELECT ub.*, bt.* 
            FROM user_buildings ub
            JOIN building_types bt ON ub.building_type_id = bt.id
            WHERE ub.id = $1 AND ub.user_id = $2`,
            [userBuildingId, userId]
        );
        const userBuilding = userBuildingResult.rows[0];
        if (!userBuilding) throw new Error('Gebäude nicht gefunden');

        // 2. Nächstes Level prüfen
        const maxLevel = 4; // Typischerweise max 4 Level
        if (userBuilding.level >= maxLevel) throw new Error('Maximales Level erreicht');

        // 3. Next-Level Kosten prüfen (vereinfacht: 1.5x aktuelle Kosten)
        const nextLevelCosts = {
            money: Math.floor(userBuilding.money_cost * 1.5),
            stone: Math.floor(userBuilding.stone_cost * 1.5),
            steel: Math.floor(userBuilding.steel_cost * 1.5),
            fuel: Math.floor(userBuilding.fuel_cost * 1.5),
        };

        const hasResources = await hasEnoughResources(userId, nextLevelCosts, client);
        if (!hasResources) throw new Error('Nicht genug Ressourcen für Upgrade');

        // 4. Ressourcen abziehen
        await deductResources(userId, nextLevelCosts, client);

        // 5. Upgrade starten
        const now = new Date();
        const upgradeEndTime = new Date(now.getTime() + userBuilding.build_time_ticks * 1500); // 1.5x länger

        await client.query(
            `UPDATE user_buildings 
            SET level = level + 1, is_constructing = TRUE, 
                construction_start_time = $1, construction_end_time = $2
            WHERE id = $3`,
            [now, upgradeEndTime, userBuildingId]
        );

        await client.query('COMMIT');
        return {
            success: true,
            newLevel: userBuilding.level + 1,
            estimatedTime: userBuilding.build_time_ticks * 1.5,
        };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Ressourcen- und Energieprüfung
// ─────────────────────────────────────────────────────────────────────────────

export async function hasEnoughResources(userId, requiredResources, client = pool) {
    const result = await client.query(
        `SELECT rt.name, ur.amount
        FROM resource_types rt
        LEFT JOIN user_resources ur ON ur.user_id = $1 AND ur.resource_type_id = rt.id
        WHERE rt.name IN ('Geld', 'Stein', 'Stahl', 'Treibstoff')`,
        [userId]
    );

    const resources = {};
    result.rows.forEach((row) => {
        resources[row.name.toLowerCase()] = row.amount || 0;
    });

    return (
        (resources.geld || 0) >= (requiredResources.money || 0) &&
        (resources.stein || 0) >= (requiredResources.stone || 0) &&
        (resources.stahl || 0) >= (requiredResources.steel || 0) &&
        (resources.treibstoff || 0) >= (requiredResources.fuel || 0)
    );
}

export async function checkPowerAvailable(userId, powerNeeded, client = pool) {
    // Berechne aktuelle Strombilanz
    const result = await client.query(
        `SELECT 
            COALESCE(SUM(CASE WHEN bt.power_production > 0 THEN bt.power_production ELSE 0 END), 0) as production,
            COALESCE(SUM(CASE WHEN bt.power_consumption > 0 THEN bt.power_consumption ELSE 0 END), 0) as consumption
        FROM user_buildings ub
        JOIN building_types bt ON ub.building_type_id = bt.id
        WHERE ub.user_id = $1 AND ub.is_constructing = FALSE`,
        [userId]
    );

    const { production, consumption } = result.rows[0];
    const availablePower = production - consumption;
    return availablePower >= powerNeeded;
}

export async function deductResources(userId, resources, client = pool) {
    const resourceMap = {
        Geld: resources.money || 0,
        Stein: resources.stone || 0,
        Stahl: resources.steel || 0,
        Treibstoff: resources.fuel || 0,
    };

    for (const [resourceName, amount] of Object.entries(resourceMap)) {
        if (amount <= 0) continue;

        await client.query(
            `UPDATE user_resources 
            SET amount = amount - $1
            WHERE user_id = $2 AND resource_type_id = (SELECT id FROM resource_types WHERE name = $3)`,
            [amount, userId, resourceName]
        );
    }
}

export async function addResources(userId, resources, client = pool) {
    const resourceMap = {
        Geld: resources.money || 0,
        Stein: resources.stone || 0,
        Stahl: resources.steel || 0,
        Treibstoff: resources.fuel || 0,
    };

    for (const [resourceName, amount] of Object.entries(resourceMap)) {
        if (amount <= 0) continue;

        await client.query(
            `UPDATE user_resources 
            SET amount = amount + $1
            WHERE user_id = $2 AND resource_type_id = (SELECT id FROM resource_types WHERE name = $3)`,
            [amount, userId, resourceName]
        );
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// TICK: Ressourcenproduktion pro Tick
// ─────────────────────────────────────────────────────────────────────────────

export async function tickProduction(userId) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Berechne Gesamtproduktion aller fertigen Gebäude
        const result = await client.query(
            `SELECT 
                COALESCE(SUM(bt.money_production), 0) as money,
                COALESCE(SUM(bt.stone_production), 0) as stone,
                COALESCE(SUM(bt.steel_production), 0) as steel,
                COALESCE(SUM(bt.fuel_production), 0) as fuel
            FROM user_buildings ub
            JOIN building_types bt ON ub.building_type_id = bt.id
            WHERE ub.user_id = $1 AND ub.is_constructing = FALSE`,
            [userId]
        );

        const production = result.rows[0];
        await addResources(
            userId,
            {
                money: production.money,
                stone: production.stone,
                steel: production.steel,
                fuel: production.fuel,
            },
            client
        );

        await client.query('COMMIT');
        return production;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}
