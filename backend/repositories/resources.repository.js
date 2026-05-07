import pool from '../database/db.js';
import * as referenceDataRepo from './reference-data.repository.js';

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

    const resourceTypeId = await referenceDataRepo.getResourceTypeIdByName(resourceName, client);
    if (!resourceTypeId) return;

    await client.query(
        `UPDATE user_resources
         SET amount = amount + $1,
             last_updated = COALESCE($4, last_updated)
         WHERE user_id = $2
           AND resource_type_id = $3`,
        [delta, userId, resourceTypeId, newTimestamp ?? null]
    );
}

function toResourceDeductions(geld, stein, stahl, treibstoff) {
    return [
        ['Geld', Math.max(0, Number(geld || 0))],
        ['Stein', Math.max(0, Number(stein || 0))],
        ['Stahl', Math.max(0, Number(stahl || 0))],
        ['Treibstoff', Math.max(0, Number(treibstoff || 0))],
    ].filter(([, amount]) => amount > 0);
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

    const resourceTypes = await referenceDataRepo.getResourceTypes(client);
    const typeByName = new Map(resourceTypes.map((entry) => [entry.name, entry.id]));

    const ids = [];
    const amounts = [];

    for (const resourceName of RESOURCE_NAMES) {
        const id = typeByName.get(resourceName);
        if (!id) continue;
        ids.push(Number(id));
        amounts.push(Math.trunc(Number(initial[resourceName] ?? 0)));
    }

    if (ids.length === 0) return;

    await client.query(
        `INSERT INTO user_resources (user_id, resource_type_id, amount, last_updated)
         SELECT $1, entry.resource_type_id, entry.amount, NOW()
         FROM UNNEST($2::INT[], $3::BIGINT[]) AS entry(resource_type_id, amount)
         ON CONFLICT (user_id, resource_type_id)
         DO UPDATE SET amount = EXCLUDED.amount, last_updated = NOW()`,
        [userId, ids, amounts]
    );
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
export async function addResources(
    userId,
    addGeld,
    addStein,
    addStahl,
    addTreibstoff,
    neueZeit,
    client = pool
) {
    await changeResourceByName(userId, 'Geld', addGeld, neueZeit, client);
    await changeResourceByName(userId, 'Stein', addStein, neueZeit, client);
    await changeResourceByName(userId, 'Stahl', addStahl, neueZeit, client);
    await changeResourceByName(userId, 'Treibstoff', addTreibstoff, neueZeit, client);
    return findByUserId(userId, client);
}

// Kosten abziehen
export async function deductResources(userId, geld, stein, stahl, treibstoff, client = pool) {
    const deductions = toResourceDeductions(geld, stein, stahl, treibstoff);
    if (deductions.length === 0) return;

    const resourceTypes = await referenceDataRepo.getResourceTypes(client);
    const typeByName = new Map(resourceTypes.map((entry) => [entry.name, entry.id]));

    const resourceTypeIds = [];
    const amounts = [];

    for (const [resourceName, amount] of deductions) {
        const resourceTypeId = typeByName.get(resourceName);
        if (!resourceTypeId) continue;
        resourceTypeIds.push(Number(resourceTypeId));
        amounts.push(Math.trunc(amount));
    }

    if (resourceTypeIds.length !== deductions.length) {
        const error = new Error('RESOURCE_TYPE_MISSING');
        error.code = 'RESOURCE_TYPE_MISSING';
        throw error;
    }

    const result = await client.query(
        `WITH requested AS (
             SELECT *
             FROM UNNEST($2::INT[], $3::BIGINT[]) AS req(resource_type_id, amount)
         ),
         required AS (
             SELECT COUNT(*)::INT AS total FROM requested
         ),
         available AS (
             SELECT COUNT(*)::INT AS total
             FROM user_resources ur
             JOIN requested req ON req.resource_type_id = ur.resource_type_id
             WHERE ur.user_id = $1
               AND ur.amount >= req.amount
         ),
         updated AS (
             UPDATE user_resources ur
             SET amount = ur.amount - req.amount
             FROM requested req, required, available
             WHERE ur.user_id = $1
               AND ur.resource_type_id = req.resource_type_id
               AND required.total = available.total
             RETURNING ur.resource_type_id
         )
         SELECT
             (SELECT total FROM required) AS required_count,
             COUNT(*)::INT AS updated_count
         FROM updated`,
        [userId, resourceTypeIds, amounts]
    );

    const summary = result.rows[0] ?? { required_count: 0, updated_count: 0 };
    if (Number(summary.updated_count) !== Number(summary.required_count)) {
        const error = new Error('INSUFFICIENT_RESOURCES');
        error.code = 'INSUFFICIENT_RESOURCES';
        throw error;
    }
}
