import { test, expect } from '@playwright/test';
import pool from '../../database/db.js';
import * as combatService from '../../services/combat.service.js';

async function registerAndLogin(request, prefix) {
    const suffix = `${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    const username = `${prefix}_${suffix}`;
    const email = `${prefix}_${suffix}@test.local`;
    const password = 'TestPass123!';

    const registerRes = await request.post('/auth/register', {
        data: { username, email, password },
    });
    expect(registerRes.status()).toBe(201);

    const loginRes = await request.post('/auth/login', {
        data: { username, password },
    });
    expect(loginRes.status()).toBe(200);

    const loginBody = await loginRes.json();
    return {
        token: loginBody.token,
        userId: Number(loginBody.user.id),
    };
}

async function getTypeIdByName(tableName, name) {
    const result = await pool.query(
        `SELECT id FROM ${tableName} WHERE name = $1`,
        [name]
    );
    return Number(result.rows[0]?.id ?? 0);
}

async function ensureDefenderNearAttacker(attackerId, defenderId) {
    const attackerPos = await pool.query(
        'SELECT koordinate_x, koordinate_y FROM users WHERE id = $1',
        [attackerId]
    );
    const x = Number(attackerPos.rows[0]?.koordinate_x ?? 1);
    const y = Number(attackerPos.rows[0]?.koordinate_y ?? 1);

    const candidates = [
        [x + 1, y],
        [x - 1, y],
        [x, y + 1],
        [x, y - 1],
        [x + 2, y],
        [x, y + 2],
    ].filter(([cx, cy]) => cx >= 1 && cx <= 999 && cy >= 1 && cy <= 999);

    for (const [cx, cy] of candidates) {
        const occupied = await pool.query(
            'SELECT 1 FROM users WHERE koordinate_x = $1 AND koordinate_y = $2 LIMIT 1',
            [cx, cy]
        );
        if (occupied.rowCount === 0) {
            await pool.query(
                'UPDATE users SET koordinate_x = $1, koordinate_y = $2 WHERE id = $3',
                [cx, cy, defenderId]
            );
            return;
        }
    }

    throw new Error('Keine freie Nachbarkoordinate fuer Verteidiger gefunden');
}

test.describe('Combat plunder transfer flow', () => {
    test('Angreifer bekommt gepluenderte Gebaeude gutgeschrieben', async ({ request }) => {
        const attacker = await registerAndLogin(request, 'e2e_atk');
        const defender = await registerAndLogin(request, 'e2e_def');

        await ensureDefenderNearAttacker(attacker.userId, defender.userId);

        const seahawkTypeId = await getTypeIdByName('unit_types', 'Seahawk');
        const soldatTypeId = await getTypeIdByName('unit_types', 'Soldat');
        const steinbruchTypeId = await getTypeIdByName('building_types', 'Steinbruch');

        expect(seahawkTypeId).toBeGreaterThan(0);
        expect(soldatTypeId).toBeGreaterThan(0);
        expect(steinbruchTypeId).toBeGreaterThan(0);

        // 100 Seahawks stellen sicher, dass der Soldat getötet wird (damage >> HP)
        const attackerUnitInsert = await pool.query(
            `INSERT INTO user_units (user_id, unit_type_id, quantity, health_percentage, is_moving)
             VALUES ($1, $2, $3, 100, FALSE)
             RETURNING id`,
            [attacker.userId, seahawkTypeId, 100]
        );
        const attackerUnitId = Number(attackerUnitInsert.rows[0].id);

        // Ausreichend Treibstoff für 100 Einheiten sicherstellen
        await pool.query(
            `UPDATE user_resources
             SET amount = 99999
             WHERE user_id = $1
               AND resource_type_id = (SELECT id FROM resource_types WHERE name = 'Treibstoff')`,
            [attacker.userId]
        );

        await pool.query(
            `INSERT INTO user_units (user_id, unit_type_id, quantity, health_percentage, is_moving)
             VALUES ($1, $2, $3, 100, FALSE)`,
            [defender.userId, soldatTypeId, 1]
        );

        await pool.query(
            `INSERT INTO user_buildings (user_id, building_type_id, level, is_constructing)
             SELECT $1, $2, 1, FALSE FROM generate_series(1, 5)`,
            [defender.userId, steinbruchTypeId]
        );

        const attackRes = await request.post('/combat/attack', {
            headers: { Authorization: `Bearer ${attacker.token}` },
            data: {
                defender_id: defender.userId,
                units: [{ user_unit_id: attackerUnitId, quantity: 100 }],
            },
        });

        expect(attackRes.status()).toBe(201);
        const attackBody = await attackRes.json();
        const missionId = Number(attackBody.data?.missionId);
        expect(missionId).toBeGreaterThan(0);

        await pool.query(
            `UPDATE combat_missions
             SET arrival_time = NOW() - INTERVAL '1 second'
             WHERE id = $1`,
            [missionId]
        );

        await combatService.processArrivingMissions();

        const attackerBuildingsRes = await request.get('/buildings/me', {
            headers: { Authorization: `Bearer ${attacker.token}` },
        });
        expect(attackerBuildingsRes.status()).toBe(200);
        const attackerBuildingsBody = await attackerBuildingsRes.json();
        const attackerSteinbruch = attackerBuildingsBody.buildings.find((b) => b.name === 'Steinbruch');
        // 5 Gebäude * 0.20 * 1.0 = floor(1.0) = 1 gestohlen
        expect(Number(attackerSteinbruch?.anzahl ?? 0)).toBe(1);

        const defenderBuildingsRes = await request.get('/buildings/me', {
            headers: { Authorization: `Bearer ${defender.token}` },
        });
        expect(defenderBuildingsRes.status()).toBe(200);
        const defenderBuildingsBody = await defenderBuildingsRes.json();
        const defenderSteinbruch = defenderBuildingsBody.buildings.find((b) => b.name === 'Steinbruch');
        expect(Number(defenderSteinbruch?.anzahl ?? 0)).toBe(4);

        const historyRes = await request.get('/combat/history', {
            headers: { Authorization: `Bearer ${attacker.token}` },
        });
        expect(historyRes.status()).toBe(200);
        const historyBody = await historyRes.json();
        const mission = historyBody.data.find((m) => Number(m.id) === missionId);
        expect(mission).toBeDefined();

        const attackerUnits = mission.result?.attackerUnits ?? [];
        const seahawkEntry = attackerUnits.find((u) => u.unitName === 'Seahawk');
        expect(seahawkEntry).toEqual(
            expect.objectContaining({ sent: 100, losses: 0, survived: 100 })
        );
    });
});

// ─── Raid-Formel: bestandsabhaengige Plünderung ───────────────────────────────
// Formel: Math.floor(bestand * 0.20 * raidPercent)
// Diese Tests verwenden einen Angreifer OHNE Verteidiger-Einheiten, sodass
// raidPercent = 1.0 (frühe Rückgabepfad) und das Ergebnis deterministisch ist.
test.describe('Raid-Formel – Bestandsabhaengige Plünderung', () => {
    async function runPlunderScenario(request, buildingCount) {
        const attacker = await registerAndLogin(request, 'e2e_raid_atk');
        const defender = await registerAndLogin(request, 'e2e_raid_def');

        await ensureDefenderNearAttacker(attacker.userId, defender.userId);

        const seahawkTypeId = await getTypeIdByName('unit_types', 'Seahawk');
        const steinbruchTypeId = await getTypeIdByName('building_types', 'Steinbruch');

        // Angreifer bekommt 1 Seahawk; Verteidiger hat KEINE Einheiten (raidPercent = 1.0 garantiert)
        const attackerUnitInsert = await pool.query(
            `INSERT INTO user_units (user_id, unit_type_id, quantity, health_percentage, is_moving)
             VALUES ($1, $2, 1, 100, FALSE)
             RETURNING id`,
            [attacker.userId, seahawkTypeId]
        );
        const attackerUnitId = Number(attackerUnitInsert.rows[0].id);

        // Verteidiger bekommt exakt buildingCount Steinbrüche
        await pool.query(
            `INSERT INTO user_buildings (user_id, building_type_id, level, is_constructing)
             SELECT $1, $2, 1, FALSE FROM generate_series(1, $3)`,
            [defender.userId, steinbruchTypeId, buildingCount]
        );

        const attackRes = await request.post('/combat/attack', {
            headers: { Authorization: `Bearer ${attacker.token}` },
            data: {
                defender_id: defender.userId,
                units: [{ user_unit_id: attackerUnitId, quantity: 1 }],
            },
        });
        expect(attackRes.status()).toBe(201);
        const missionId = Number((await attackRes.json()).data?.missionId);
        expect(missionId).toBeGreaterThan(0);

        await pool.query(
            `UPDATE combat_missions SET arrival_time = NOW() - INTERVAL '1 second' WHERE id = $1`,
            [missionId]
        );
        await combatService.processArrivingMissions();

        const atkBuildingsRes = await request.get('/buildings/me', {
            headers: { Authorization: `Bearer ${attacker.token}` },
        });
        expect(atkBuildingsRes.status()).toBe(200);
        const atkSteinbruch = (await atkBuildingsRes.json()).buildings.find((b) => b.name === 'Steinbruch');

        const defBuildingsRes = await request.get('/buildings/me', {
            headers: { Authorization: `Bearer ${defender.token}` },
        });
        expect(defBuildingsRes.status()).toBe(200);
        const defSteinbruch = (await defBuildingsRes.json()).buildings.find((b) => b.name === 'Steinbruch');

        return {
            attackerStole: Number(atkSteinbruch?.anzahl ?? 0),
            defenderRemains: Number(defSteinbruch?.anzahl ?? 0),
        };
    }

    test('10 Gebaeude → 2 gestohlen (floor(10 * 0.20 * 1.0))', async ({ request }) => {
        const { attackerStole, defenderRemains } = await runPlunderScenario(request, 10);
        expect(attackerStole).toBe(2);
        expect(defenderRemains).toBe(8);
    });

    test('98 Gebaeude → 19 gestohlen (floor(98 * 0.20 * 1.0) = floor(19.6))', async ({ request }) => {
        const { attackerStole, defenderRemains } = await runPlunderScenario(request, 98);
        expect(attackerStole).toBe(19);
        expect(defenderRemains).toBe(79);
    });

    test('100 Gebaeude → 20 gestohlen (floor(100 * 0.20 * 1.0))', async ({ request }) => {
        const { attackerStole, defenderRemains } = await runPlunderScenario(request, 100);
        expect(attackerStole).toBe(20);
        expect(defenderRemains).toBe(80);
    });

    test('1 Gebaeude → 0 gestohlen (Mindestschutz: 1 bleibt)', async ({ request }) => {
        const { attackerStole, defenderRemains } = await runPlunderScenario(request, 1);
        // floor(1 * 0.20 * 1.0) = 0; toRemove = min(0, count-1) = 0
        expect(attackerStole).toBe(0);
        expect(defenderRemains).toBe(1);
    });
});