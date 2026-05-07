import { test, expect } from '@playwright/test';
import pool from '../../database/db.js';
import { registerAndLogin } from './helpers.js';

async function getAnyCombatUnitTypeId() {
    const result = await pool.query(
        `SELECT id
         FROM unit_types
         WHERE attack_points > 0
         ORDER BY id
         LIMIT 1`
    );
    return Number(result.rows[0]?.id ?? 0);
}

test.describe('POST /units/attack ownership', () => {
    test('lehnt Angriff mit fremder Einheit ab', async ({ request }) => {
        const owner = await registerAndLogin(request, 'atk_owner');
        const intruder = await registerAndLogin(request, 'atk_intruder');

        const unitTypeId = await getAnyCombatUnitTypeId();
        expect(unitTypeId).toBeGreaterThan(0);

        const ownerUnitInsert = await pool.query(
            `INSERT INTO user_units (user_id, unit_type_id, quantity, health_percentage, is_moving)
             VALUES ($1, $2, 1, 100, FALSE)
             RETURNING id`,
            [owner.userId, unitTypeId]
        );
        const ownerUnitId = Number(ownerUnitInsert.rows[0]?.id ?? 0);
        expect(ownerUnitId).toBeGreaterThan(0);

        const intruderUnitInsert = await pool.query(
            `INSERT INTO user_units (user_id, unit_type_id, quantity, health_percentage, is_moving)
             VALUES ($1, $2, 1, 100, FALSE)
             RETURNING id`,
            [intruder.userId, unitTypeId]
        );
        const intruderUnitId = Number(intruderUnitInsert.rows[0]?.id ?? 0);
        expect(intruderUnitId).toBeGreaterThan(0);

        const res = await request.post('/units/attack', {
            headers: { Authorization: `Bearer ${intruder.token}` },
            data: {
                attacking_unit_id: ownerUnitId,
                target_unit_id: intruderUnitId,
            },
        });

        expect(res.status()).toBe(404);
        const body = await res.json();
        expect(body?.error?.code).toBe('UNIT_NOT_FOUND');
    });
});
