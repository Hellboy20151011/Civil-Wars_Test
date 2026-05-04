import express from 'express';
import { z } from 'zod';
import pool from '../database/db.js';
import { asyncWrapper } from '../middleware/asyncWrapper.js';
import { validateBody } from '../middleware/validate.js';
import { apiLimiter } from '../middleware/rateLimiters.js';
import { requireAuth } from './auth.js';
import * as buildingRepo from '../repositories/building.repository.js';
import * as resourcesRepo from '../repositories/resources.repository.js';
import * as economyService from '../services/economy.service.js';

const router = express.Router();

const LEVEL_NAME_REGEX = /^(.*) Level (\d+)$/;
const MONEY_PRODUCTION_BUILDINGS = ['Wohnhaus', 'Reihenhaus', 'Mehrfamilienhaus', 'Hochhaus'];

function getLevelMeta(buildingName) {
    const match = buildingName.match(LEVEL_NAME_REGEX);
    if (!match) return null;

    return {
        baseName: match[1],
        level: Number(match[2]),
    };
}

function getBuiltLevelSet(buildings, baseName) {
    const levels = new Set();

    for (const entry of buildings) {
        if (Number(entry.anzahl) <= 0) continue;
        const meta = getLevelMeta(entry.name);
        if (!meta || meta.baseName !== baseName) continue;
        levels.add(meta.level);
    }

    return levels;
}

function getMissingProductionChains(buildings) {
    const builtNames = new Set(
        buildings.filter((entry) => Number(entry.anzahl) > 0).map((entry) => entry.name)
    );

    const missing = [];

    if (!MONEY_PRODUCTION_BUILDINGS.some((name) => builtNames.has(name))) {
        missing.push('Geldproduktion (Wohnhaus/Reihenhaus/Mehrfamilienhaus/Hochhaus)');
    }
    if (!builtNames.has('Steinbruch')) {
        missing.push('Steinproduktion (Steinbruch)');
    }
    if (!builtNames.has('Stahlwerk')) {
        missing.push('Stahlproduktion (Stahlwerk)');
    }
    if (!builtNames.has('Öl-Raffinerie')) {
        missing.push('Treibstoffproduktion (Öl-Raffinerie)');
    }

    return missing;
}

const buildSchema = z.object({
    building_type_id: z.coerce
        .number()
        .int()
        .positive('building_type_id muss eine positive Ganzzahl sein'),
    anzahl: z.coerce.number().int().min(1, 'anzahl muss mindestens 1 sein').default(1),
});

// GET /buildings/types  – alle verfügbaren Gebäudetypen
router.get(
    '/types',
    requireAuth,
    apiLimiter,
    asyncWrapper(async (req, res) => {
        const types = await buildingRepo.findAllTypes();
        res.json(types);
    })
);

// GET /buildings/me  – Gebäude + Queue des eingeloggten Users
router.get(
    '/me',
    requireAuth,
    apiLimiter,
    asyncWrapper(async (req, res) => {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            await economyService.processFinishedQueue(req.user.id, client);
            const buildings = await buildingRepo.findBuildingsByUser(req.user.id, client);
            const queue = await buildingRepo.findQueueByUser(req.user.id, client);
            await client.query('COMMIT');
            res.json({ buildings, queue });
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    })
);

// GET /buildings/queue  – nur die Bauwarteschlange
router.get(
    '/queue',
    requireAuth,
    apiLimiter,
    asyncWrapper(async (req, res) => {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            await economyService.processFinishedQueue(req.user.id, client);
            const queue = await buildingRepo.findQueueByUser(req.user.id, client);
            await client.query('COMMIT');
            res.json(queue);
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    })
);

// POST /buildings/build  – Bau eines Gebäudes starten
router.post(
    '/build',
    requireAuth,
    apiLimiter,
    validateBody(buildSchema),
    asyncWrapper(async (req, res) => {
        const { building_type_id, anzahl } = req.body;
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Ticks und fertige Aufträge verarbeiten bevor Ressourcen geprüft werden
            await economyService.applyProductionTicks(req.user.id, client);
            await economyService.processFinishedQueue(req.user.id, client);

            const bt = await buildingRepo.findTypeById(building_type_id, client);
            if (!bt) {
                await client.query('ROLLBACK');
                return res.status(404).json({ message: 'Gebäudetyp nicht gefunden' });
            }

            // Rathaus kann nicht manuell gebaut werden (wird bei Registrierung gesetzt)
            if (bt.name === 'Rathaus') {
                await client.query('ROLLBACK');
                return res
                    .status(400)
                    .json({ message: 'Das Rathaus wurde bereits beim Start gebaut.' });
            }

            const builtBuildings = await buildingRepo.findBuildingsByUser(req.user.id, client);

            const levelMeta = getLevelMeta(bt.name);
            if (levelMeta) {
                const builtLevels = getBuiltLevelSet(builtBuildings, levelMeta.baseName);

                if (builtLevels.has(levelMeta.level)) {
                    await client.query('ROLLBACK');
                    return res
                        .status(400)
                        .json({ message: `${bt.name} ist bereits gebaut.` });
                }

                if (levelMeta.level > 1 && !builtLevels.has(levelMeta.level - 1)) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({
                        message: `Du musst zuerst ${levelMeta.baseName} Level ${levelMeta.level - 1} bauen.`,
                    });
                }
            }

            if (bt.category === 'military' || bt.category === 'government') {
                const missingProductionChains = getMissingProductionChains(builtBuildings);
                if (missingProductionChains.length > 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({
                        message: `Für ${bt.category === 'military' ? 'Militär-' : 'Regierungs-'}gebäude brauchst du mindestens je ein Produktionsgebäude für alle Ressourcen. Fehlend: ${missingProductionChains.join(', ')}`,
                    });
                }
            }

            // Strom prüfen: würde der Bau die freie Kapazität überschreiten?
            if (Number(bt.power_consumption) > 0) {
                const strom = await economyService.getStromStatus(req.user.id, client);
                const neuerVerbrauch = strom.verbrauch + Number(bt.power_consumption) * anzahl;
                if (neuerVerbrauch > strom.produktion) {
                    await client.query('ROLLBACK');
                    return res
                        .status(400)
                        .json({ message: 'Nicht genug freier Strom für dieses Gebäude.' });
                }
            }

            // Ressourcen FOR UPDATE sperren und prüfen
            const resources = await resourcesRepo.findByUserIdLocked(req.user.id, client);
            if (!resources) {
                await client.query('ROLLBACK');
                return res.status(404).json({ message: 'Ressourcen nicht gefunden' });
            }

            const totalGeld = Number(bt.money_cost) * anzahl;
            const totalStein = Number(bt.stone_cost) * anzahl;
            const totalStahl = Number(bt.steel_cost) * anzahl;
            const totalTreibstoff = Number(bt.fuel_cost) * anzahl;

            if (Number(resources.geld) < totalGeld) {
                await client.query('ROLLBACK');
                return res
                    .status(400)
                    .json({ message: `Nicht genug Geld. Benötigt: ${totalGeld}` });
            }
            if (Number(resources.stein) < totalStein) {
                await client.query('ROLLBACK');
                return res
                    .status(400)
                    .json({ message: `Nicht genug Stein. Benötigt: ${totalStein}` });
            }
            if (Number(resources.stahl) < totalStahl) {
                await client.query('ROLLBACK');
                return res
                    .status(400)
                    .json({ message: `Nicht genug Stahl. Benötigt: ${totalStahl}` });
            }
            if (Number(resources.treibstoff) < totalTreibstoff) {
                await client.query('ROLLBACK');
                return res
                    .status(400)
                    .json({ message: `Nicht genug Treibstoff. Benötigt: ${totalTreibstoff}` });
            }

            // Kosten abziehen
            await resourcesRepo.deductResources(
                req.user.id,
                totalGeld,
                totalStein,
                totalStahl,
                totalTreibstoff,
                client
            );

            const label = anzahl > 1 ? `${anzahl}x ${bt.name}` : bt.name;

            if (Number(bt.build_time_ticks) > 0) {
                // Nur ein aktiver Auftrag pro Gebäudetyp in der Queue
                const existing = await buildingRepo.findExistingQueueEntry(
                    req.user.id,
                    building_type_id,
                    client
                );
                if (existing) {
                    await client.query('ROLLBACK');
                    return res
                        .status(400)
                        .json({ message: `${bt.name} ist bereits in der Bauwarteschlange.` });
                }
                const auftrag = await buildingRepo.createQueueEntry(
                    req.user.id,
                    building_type_id,
                    anzahl,
                    bt.build_time_ticks,
                    client
                );
                await client.query('COMMIT');
                const fertigStr = new Date(auftrag.fertig_am).toLocaleTimeString('de-DE', {
                    hour: '2-digit',
                    minute: '2-digit',
                });
                res.status(201).json({
                    message: `${label} wird gebaut (fertig um ${fertigStr}).`,
                    auftrag,
                });
            } else {
                // Sofortiger Bau (build_time_ticks = 0)
                await buildingRepo.upsertBuilding(req.user.id, building_type_id, anzahl, client);
                await client.query('COMMIT');
                res.status(201).json({ message: `${label} erfolgreich gebaut.` });
            }
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    })
);

export default router;
