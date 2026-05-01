import express from 'express';
import pool from '../database/db.js';
import { requireAuth } from './auth.js';

const router = express.Router();

// GET /buildings/me  – alle Gebäude des eingeloggten Users
router.get('/me', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT ub.id, ub.building_type_id, ub.level, ub.status,
                    ub.construction_start_time, ub.construction_end_time,
                    bt.name, bt.build_time
             FROM user_buildings ub
             JOIN building_types bt ON bt.id = ub.building_type_id
             WHERE ub.user_id = $1`,
            [req.user.id]
        );
        res.json({ buildings: result.rows });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// POST /buildings/build  – Bau eines Gebäudes starten
// Body: { building_type_id }
router.post('/build', requireAuth, async (req, res) => {
    const { building_type_id } = req.body;

    if (!building_type_id) {
        return res.status(400).json({ message: 'building_type_id ist erforderlich' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Gebäudetyp laden
        const typeResult = await client.query(
            'SELECT * FROM building_types WHERE id = $1',
            [building_type_id]
        );
        if (typeResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Gebäudetyp nicht gefunden' });
        }
        const bt = typeResult.rows[0];

        // Bereits vorhanden?
        const existing = await client.query(
            'SELECT id, status FROM user_buildings WHERE user_id = $1 AND building_type_id = $2',
            [req.user.id, building_type_id]
        );
        if (existing.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({
                message: 'Dieses Gebäude existiert bereits',
                building: existing.rows[0]
            });
        }

        // Ressourcen prüfen und abziehen
        const costs = [
            { name: 'Stein',  cost: bt.stone_cost },
            { name: 'Metall', cost: bt.metal_cost },
            { name: 'Geld',   cost: bt.money_cost },
        ].filter(c => c.cost > 0);

        for (const { name, cost } of costs) {
            const resResult = await client.query(
                `SELECT ur.amount FROM user_resources ur
                 JOIN resource_types rt ON rt.id = ur.resource_type_id
                 WHERE ur.user_id = $1 AND rt.name = $2`,
                [req.user.id, name]
            );
            const current = resResult.rows[0]?.amount ?? 0;
            if (current < cost) {
                await client.query('ROLLBACK');
                return res.status(400).json({
                    message: `Nicht genug ${name}. Benötigt: ${cost}, Vorhanden: ${current}`
                });
            }
            await client.query(
                `UPDATE user_resources SET amount = amount - $1
                 WHERE user_id = $2
                 AND resource_type_id = (SELECT id FROM resource_types WHERE name = $3)`,
                [cost, req.user.id, name]
            );
        }

        // Gebäude eintragen
        const endTime = new Date(Date.now() + bt.build_time * 60 * 1000);
        const newBuilding = await client.query(
            `INSERT INTO user_buildings
                (user_id, building_type_id, status, construction_start_time, construction_end_time)
             VALUES ($1, $2, 'in_progress', NOW(), $3)
             RETURNING *`,
            [req.user.id, building_type_id, endTime]
        );

        await client.query('COMMIT');
        res.status(201).json({ building: newBuilding.rows[0] });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    } finally {
        client.release();
    }
});

// POST /buildings/complete/:id  – Bau abschließen (Server prüft ob Zeit abgelaufen)
router.post('/complete/:id', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            `UPDATE user_buildings
             SET status = 'complete'
             WHERE id = $1
               AND user_id = $2
               AND status = 'in_progress'
               AND construction_end_time <= NOW()
             RETURNING *`,
            [req.params.id, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(400).json({ message: 'Bau noch nicht abgeschlossen oder nicht gefunden' });
        }

        res.json({ building: result.rows[0] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

export default router;
