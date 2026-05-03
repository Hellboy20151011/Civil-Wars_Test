/**
 * Spieler-Initialisierung - Erstellt neue Spieler mit Starterressourcen und Rathaus
 */

import pool from '../database/db.js';

export async function initializeNewPlayer(userId, username) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Ressourcen initialisieren
        const resourceTypes = [
            { name: 'Geld', amount: 50000 },        // 50.000€ Startkapital
            { name: 'Stein', amount: 100 },         // 100t
            { name: 'Stahl', amount: 50 },          // 50t
            { name: 'Treibstoff', amount: 0 }       // 0L
        ];

        for (const resource of resourceTypes) {
            const rtResult = await client.query(
                'SELECT id FROM resource_types WHERE name = $1',
                [resource.name]
            );
            
            if (rtResult.rows.length > 0) {
                await client.query(
                    `INSERT INTO user_resources (user_id, resource_type_id, amount)
                    VALUES ($1, $2, $3)
                    ON CONFLICT (user_id, resource_type_id) DO UPDATE
                    SET amount = $3`,
                    [userId, rtResult.rows[0].id, resource.amount]
                );
            }
        }

        // 2. Rathaus bauen
        const rathausResult = await client.query(
            'SELECT id FROM building_types WHERE name = $1',
            [
                'Rathaus'
            ]
        );

        if (rathausResult.rows.length > 0) {
            await client.query(
                `INSERT INTO user_buildings 
                (user_id, building_type_id, level, is_constructing, location_x, location_y)
                VALUES ($1, $2, 1, FALSE, $3, $4)`,
                [userId, rathausResult.rows[0].id, 0, 0] // Zentrale Position (0, 0)
            );
        }

        await client.query('COMMIT');
        return { success: true, message: `Spieler '${username}' initialisiert mit Starterressourcen und Rathaus` };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

/**
 * Tick-System ausführen - Wird regelmäßig aufgerufen (10 Min oder 1 Min im Dev)
 * Führt Ressourcenproduktion durch und prüft fertige Gebäude/Einheiten
 */
export async function executeTick() {
    const client = await pool.connect();
    try {
        // 1. Alle Spieler abrufen
        const usersResult = await client.query('SELECT id FROM users');
        const users = usersResult.rows;

        for (const user of users) {
            // 2. Ressourcenproduktion für Spieler
            const productionResult = await client.query(
                `SELECT 
                    COALESCE(SUM(bt.money_production), 0) as money,
                    COALESCE(SUM(bt.stone_production), 0) as stone,
                    COALESCE(SUM(bt.steel_production), 0) as steel,
                    COALESCE(SUM(bt.fuel_production), 0) as fuel
                FROM user_buildings ub
                JOIN building_types bt ON ub.building_type_id = bt.id
                WHERE ub.user_id = $1 AND ub.is_constructing = FALSE`,
                [user.id]
            );

            const production = productionResult.rows[0];
            if (production.money > 0 || production.stone > 0 || production.steel > 0 || production.fuel > 0) {
                // Ressourcen hinzufügen
                const rtResult = await client.query(
                    `SELECT id, name FROM resource_types WHERE name IN ('Geld', 'Stein', 'Stahl', 'Treibstoff')`
                );

                for (const rt of rtResult.rows) {
                    let amount = 0;
                    switch (rt.name) {
                        case 'Geld': amount = production.money; break;
                        case 'Stein': amount = production.stone; break;
                        case 'Stahl': amount = production.steel; break;
                        case 'Treibstoff': amount = production.fuel; break;
                    }

                    if (amount > 0) {
                        await client.query(
                            `UPDATE user_resources SET amount = amount + $1
                            WHERE user_id = $2 AND resource_type_id = $3`,
                            [amount, user.id, rt.id]
                        );
                    }
                }
            }

            // 3. Fertige Gebäude umschalten
            const now = new Date();
            await client.query(
                `UPDATE user_buildings 
                SET is_constructing = FALSE
                WHERE user_id = $1 AND is_constructing = TRUE AND construction_end_time <= $2`,
                [user.id, now]
            );

            // 4. Einheiten am Ziel ankommen lassen
            await client.query(
                `UPDATE user_units 
                SET is_moving = FALSE, location_x = destination_x, location_y = destination_y,
                    destination_x = NULL, destination_y = NULL, arrival_time = NULL
                WHERE user_id = $1 AND is_moving = TRUE AND arrival_time <= $2`,
                [user.id, now]
            );
        }

        console.log(`[TICK] Ausgeführt für ${users.length} Spieler`);
        return { success: true, playersProcessed: users.length };
    } catch (error) {
        console.error('[TICK] Fehler:', error);
        throw error;
    } finally {
        client.release();
    }
}
