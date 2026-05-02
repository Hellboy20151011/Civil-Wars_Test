import pool from '../database/db.js';

// Startressourcen für neue Spieler anlegen
export async function initForUser(userId, client = pool) {
    await client.query(
        `INSERT INTO user_resources (user_id, geld, stein, eisen, treibstoff)
         VALUES ($1, 500000, 5000, 2000, 500)
         ON CONFLICT (user_id) DO NOTHING`,
        [userId]
    );
}

// Ressourcen lesen (mit FOR UPDATE für transaktionssichere Buchungen)
export async function findByUserIdLocked(userId, client = pool) {
    const result = await client.query(
        `SELECT user_id, geld, stein, eisen, treibstoff, letzte_aktualisierung
         FROM user_resources WHERE user_id = $1 FOR UPDATE`,
        [userId]
    );
    return result.rows[0] ?? null;
}

// Ressourcen ohne Lock lesen (für reine Anzeige)
export async function findByUserId(userId, client = pool) {
    const result = await client.query(
        'SELECT user_id, geld, stein, eisen, treibstoff, letzte_aktualisierung FROM user_resources WHERE user_id = $1',
        [userId]
    );
    return result.rows[0] ?? null;
}

// Tick-Produktion aufaddieren
export async function addResources(userId, addGeld, addStein, addEisen, addTreibstoff, neueZeit, client = pool) {
    const result = await client.query(
        `UPDATE user_resources
         SET geld       = geld       + $1,
             stein      = stein      + $2,
             eisen      = eisen      + $3,
             treibstoff = treibstoff + $4,
             letzte_aktualisierung = $5
         WHERE user_id = $6
         RETURNING geld, stein, eisen, treibstoff`,
        [addGeld, addStein, addEisen, addTreibstoff, neueZeit, userId]
    );
    return result.rows[0];
}

// Kosten abziehen
export async function deductResources(userId, geld, stein, eisen, treibstoff, client = pool) {
    await client.query(
        `UPDATE user_resources
         SET geld       = geld       - $1,
             stein      = stein      - $2,
             eisen      = eisen      - $3,
             treibstoff = treibstoff - $4
         WHERE user_id = $5`,
        [geld, stein, eisen, treibstoff, userId]
    );
}
