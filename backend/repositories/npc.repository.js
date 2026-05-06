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
