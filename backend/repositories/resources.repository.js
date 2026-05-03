import pool from '../database/db.js';

const RESOURCE_NAMES = ['Geld', 'Stein', 'Stahl', 'Treibstoff', 'Strom'];

function toFlatResources(rows, userId) {
    const byName = new Map(rows.map((row) => [row.name, row]));
    const geld = Number(byName.get('Geld')?.amount ?? 0);
    const stein = Number(byName.get('Stein')?.amount ?? 0);
    const stahl = Number(byName.get('Stahl')?.amount ?? 0);
    const treibstoff = Number(byName.get('Treibstoff')?.amount ?? 0);
    const strom = Number(byName.get('Strom')?.amount ?? 0);

    return {
        user_id: String(userId),
        geld,
        stein,
        stahl,
        treibstoff,
        strom,
        last_updated: rows[0]?.last_updated ?? null,
    };
}

async function changeResourceByName(userId, resourceName, delta, newTimestamp, client = pool) {
    if (!delta) return;

    await client.query(
        `UPDATE user_resources ur
         SET amount = ur.amount + $1,
             last_updated = COALESCE($4, ur.last_updated)
         FROM resource_types rt
         WHERE ur.user_id = $2
           AND ur.resource_type_id = rt.id
           AND rt.name = $3`,
        [delta, userId, resourceName, newTimestamp ?? null]
    );
}

// Startressourcen für neue Spieler anlegen
export async function initForUser(userId, client = pool) {
    const initial = {
        Geld: 500000,
        Stein: 5000,
        Stahl: 2000,
        Treibstoff: 500,
        Strom: 0,
    };

    for (const resourceName of RESOURCE_NAMES) {
        await client.query(
            `INSERT INTO user_resources (user_id, resource_type_id, amount, last_updated)
             VALUES (
                $1,
                (SELECT id FROM resource_types WHERE name = $2),
                $3,
                NOW()
             )
             ON CONFLICT (user_id, resource_type_id)
             DO UPDATE SET amount = EXCLUDED.amount, last_updated = NOW()`,
            [userId, resourceName, initial[resourceName] ?? 0]
        );
    }
}

// Ressourcen lesen (mit FOR UPDATE für transaktionssichere Buchungen)
export async function findByUserIdLocked(userId, client = pool) {
    const result = await client.query(
        `SELECT ur.user_id, ur.amount, ur.last_updated, rt.name
         FROM user_resources ur
         JOIN resource_types rt ON rt.id = ur.resource_type_id
         WHERE ur.user_id = $1
         FOR UPDATE`,
        [userId]
    );

    if (result.rows.length === 0) return null;
    return toFlatResources(result.rows, userId);
}

// Ressourcen ohne Lock lesen (für reine Anzeige)
export async function findByUserId(userId, client = pool) {
    const result = await client.query(
        `SELECT ur.user_id, ur.amount, ur.last_updated, rt.name
         FROM user_resources ur
         JOIN resource_types rt ON rt.id = ur.resource_type_id
         WHERE ur.user_id = $1`,
        [userId]
    );

    if (result.rows.length === 0) return null;
    return toFlatResources(result.rows, userId);
}

// Tick-Produktion aufaddieren
export async function addResources(userId, addGeld, addStein, addStahl, addTreibstoff, neueZeit, client = pool) {
    await changeResourceByName(userId, 'Geld', addGeld, neueZeit, client);
    await changeResourceByName(userId, 'Stein', addStein, neueZeit, client);
    await changeResourceByName(userId, 'Stahl', addStahl, neueZeit, client);
    await changeResourceByName(userId, 'Treibstoff', addTreibstoff, neueZeit, client);
    return findByUserId(userId, client);
}

// Kosten abziehen
export async function deductResources(userId, geld, stein, stahl, treibstoff, client = pool) {
    await changeResourceByName(userId, 'Geld', -Math.max(0, Number(geld || 0)), null, client);
    await changeResourceByName(userId, 'Stein', -Math.max(0, Number(stein || 0)), null, client);
    await changeResourceByName(userId, 'Stahl', -Math.max(0, Number(stahl || 0)), null, client);
    await changeResourceByName(userId, 'Treibstoff', -Math.max(0, Number(treibstoff || 0)), null, client);
}
