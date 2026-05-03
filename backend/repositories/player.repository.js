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
        'SELECT id, username, email, password_hash, role, is_active FROM users WHERE username = $1',
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
