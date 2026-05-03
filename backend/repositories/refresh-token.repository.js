import pool from '../database/db.js';

export async function createRefreshToken(userId, tokenHash, expiresAt, client = pool) {
    await client.query(
        `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
         VALUES ($1, $2, $3)`,
        [userId, tokenHash, expiresAt]
    );
}

export async function findActiveByHashForUpdate(tokenHash, client = pool) {
    const result = await client.query(
        `SELECT id, user_id, token_hash, expires_at, revoked_at
         FROM refresh_tokens
         WHERE token_hash = $1
         FOR UPDATE`,
        [tokenHash]
    );

    const row = result.rows[0] ?? null;
    if (!row) return null;

    if (row.revoked_at) return null;
    if (new Date(row.expires_at).getTime() <= Date.now()) return null;

    return row;
}

export async function revokeAndReplace(tokenHash, replacementTokenHash, client = pool) {
    await client.query(
        `UPDATE refresh_tokens
         SET revoked_at = NOW(), replaced_by_token_hash = $2
         WHERE token_hash = $1`,
        [tokenHash, replacementTokenHash]
    );
}
