import pool from '../database/db.js';

export async function findById(id, client = pool) {
    const result = await client.query(
        'SELECT id, email, username, role, is_active, koordinate_x, koordinate_y, created_at FROM users WHERE id = $1',
        [id]
    );
    return result.rows[0] ?? null;
}

export async function findAllIds(client = pool) {
    const result = await client.query('SELECT id FROM users');
    return result.rows;
}

export async function findActiveIds(client = pool) {
    const result = await client.query('SELECT id FROM users WHERE is_active = TRUE');
    return result.rows;
}

export async function findByUsernameOrEmail(username, email, client = pool) {
    const result = await client.query('SELECT id FROM users WHERE username = $1 OR email = $2', [
        username,
        email,
    ]);
    return result.rows[0] ?? null;
}

export async function findByUsername(username, client = pool) {
    const result = await client.query(
        'SELECT id, username, email, password_hash, role, is_active, failed_login_attempts, locked_until FROM users WHERE username = $1',
        [username]
    );
    return result.rows[0] ?? null;
}

export async function create(
    username,
    email,
    passwordHash,
    koordinateX,
    koordinateY,
    client = pool
) {
    const result = await client.query(
        `INSERT INTO users (email, username, password_hash, koordinate_x, koordinate_y)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, email, username, role, is_active, created_at`,
        [email, username, passwordHash, koordinateX, koordinateY]
    );
    return result.rows[0];
}

export async function findByKoordinaten(x, y, client = pool) {
    const result = await client.query(
        'SELECT id FROM users WHERE koordinate_x = $1 AND koordinate_y = $2',
        [x, y]
    );
    return result.rows[0] ?? null;
}

export async function updateLastLogin(id, client = pool) {
    await client.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [id]);
}

export async function incrementFailedLogin(id, client = pool) {
    await client.query(
        'UPDATE users SET failed_login_attempts = failed_login_attempts + 1 WHERE id = $1',
        [id]
    );
}

export async function lockAccount(id, lockedUntil, client = pool) {
    await client.query(
        'UPDATE users SET locked_until = $1 WHERE id = $2',
        [lockedUntil, id]
    );
}

export async function resetFailedLogin(id, client = pool) {
    await client.query(
        'UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = $1',
        [id]
    );
}

/**
 * Liefert alle aktiven Spieler mit ihren Kartenkoordinaten fuer das Karten-Rendering.
 *
 * @param {import('pg').PoolClient|import('pg').Pool} [client=pool]
 * @returns {Promise<Array<{ id: number, username: string, koordinate_x: number, koordinate_y: number }>>}
 */
export async function findAllForMap(client = pool) {
    const result = await client.query(
        'SELECT id, username, koordinate_x, koordinate_y FROM users WHERE is_active = TRUE AND koordinate_x IS NOT NULL AND koordinate_y IS NOT NULL ORDER BY id'
    );
    return result.rows;
}
