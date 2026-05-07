import pool from '../database/db.js';

/**
 * Liefert alle aktiven NPC-IDs mit ihrem Typ.
 */
export async function findActiveNpcs(client = pool) {
    const result = await client.query(
        `SELECT id, username, npc_type, koordinate_x, koordinate_y
         FROM users
         WHERE is_npc = TRUE AND is_active = TRUE`,
    );
    return result.rows;
}

/**
 * Erstellt einen NPC-User direkt in der DB (kein Auth-Flow nötig).
 *
 * @param {string} username
 * @param {string} npcType  'defensive' | 'aggressive'
 * @param {number} x
 * @param {number} y
 * @param {import('pg').PoolClient} [client]
 * @returns {Promise<{ id: number }>}
 */
export async function createNpc(username, npcType, x, y, client = pool) {
    const email = `npc_${username.toLowerCase().replace(/\s+/g, '_')}@civil-wars.internal`;
    const result = await client.query(
        `INSERT INTO users (email, username, password_hash, koordinate_x, koordinate_y, is_npc, npc_type)
         VALUES ($1, $2, 'NPC_NO_LOGIN', $3, $4, TRUE, $5)
         RETURNING id`,
        [email, username, x, y, npcType],
    );
    return result.rows[0];
}

/**
 * Laufzeitübersicht für NPC-Debugging (Bau, Einheiten, aktive Missionen).
 */
export async function findNpcDebugSummary(client = pool) {
    const result = await client.query(
        `SELECT u.id,
                u.username,
                u.npc_type,
                u.is_active,
                u.koordinate_x,
                u.koordinate_y,
                COALESCE(b.ready_buildings, 0)::INTEGER AS ready_buildings,
                COALESCE(b.constructing_buildings, 0)::INTEGER AS constructing_buildings,
                COALESCE(units.unit_stacks, 0)::INTEGER AS unit_stacks,
                COALESCE(units.total_units, 0)::INTEGER AS total_units,
                COALESCE(units.moving_stacks, 0)::INTEGER AS moving_stacks,
                COALESCE(units.moving_units, 0)::INTEGER AS moving_units,
                COALESCE(cm.active_combat_missions, 0)::INTEGER AS active_combat_missions,
                COALESCE(sm.active_spy_missions, 0)::INTEGER AS active_spy_missions
         FROM users u
         LEFT JOIN LATERAL (
             SELECT COUNT(*) FILTER (WHERE ub.is_constructing = FALSE) AS ready_buildings,
                    COUNT(*) FILTER (WHERE ub.is_constructing = TRUE) AS constructing_buildings
             FROM user_buildings ub
             WHERE ub.user_id = u.id
         ) b ON TRUE
         LEFT JOIN LATERAL (
             SELECT COUNT(*) AS unit_stacks,
                    COALESCE(SUM(uu.quantity), 0) AS total_units,
                    COUNT(*) FILTER (WHERE uu.is_moving = TRUE) AS moving_stacks,
                    COALESCE(SUM(uu.quantity) FILTER (WHERE uu.is_moving = TRUE), 0) AS moving_units
             FROM user_units uu
             WHERE uu.user_id = u.id
         ) units ON TRUE
         LEFT JOIN LATERAL (
             SELECT COUNT(*) AS active_combat_missions
             FROM combat_missions cm
             WHERE cm.attacker_id = u.id
               AND cm.status IN ('traveling_to', 'in_combat', 'traveling_back')
         ) cm ON TRUE
         LEFT JOIN LATERAL (
             SELECT COUNT(*) AS active_spy_missions
             FROM spy_missions sm
             WHERE sm.spy_id = u.id
               AND sm.status IN ('traveling_to', 'spying', 'traveling_back')
         ) sm ON TRUE
         WHERE u.is_npc = TRUE
         ORDER BY u.id`
    );
    return result.rows;
}
