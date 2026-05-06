/**
 * Buildings Service - Handhabt Gebäudebau, Upgrades und Ressourcenprüfung
 * Tick-System: 1 Tick = 10 Min (Production) / 1 Min (Dev)
 */

import * as buildingRepo from '../repositories/building.repository.js';
import * as resourcesRepo from '../repositories/resources.repository.js';
import { withTransaction } from '../repositories/transaction.repository.js';
import * as economyService from './economy.service.js';
import { createServiceError } from './service-error.js';

const LEVEL_NAME_REGEX = /^(.*) Level (\d+)$/;
const MONEY_PRODUCTION_BUILDINGS = ['Wohnhaus', 'Reihenhaus', 'Mehrfamilienhaus', 'Hochhaus'];

// Kategorien, bei denen jedes weitere gebaute Gebäude 3% teurer wird (linear)
const SCALABLE_CATEGORIES = ['infrastructure', 'housing'];
const COST_SCALE_PER_BUILDING = 0.03;

/**
 * Berechnet die skalierten Gesamtkosten für `quantity` Gebäude,
 * wenn bereits `existingCount` Gebäude dieses Typs vorhanden sind.
 * Formel: Σ floor(baseCost × (1 + (existingCount + i) × scale)), i = 0…quantity-1
 */
function calculateScaledTotal(baseCost, existingCount, quantity, scale) {
    let total = 0;
    for (let i = 0; i < quantity; i++) {
        total += Math.floor(baseCost * (1 + (existingCount + i) * scale));
    }
    return total;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET: Gebäude abrufen
// ─────────────────────────────────────────────────────────────────────────────

export async function getUserBuildings(userId) {
    return buildingRepo.findDetailedByUser(userId);
}

export async function getBuildingById(buildingId) {
    return buildingRepo.findTypeById(buildingId);
}

export async function getBuildingByName(name) {
    return buildingRepo.findTypeByName(name);
}

// ─────────────────────────────────────────────────────────────────────────────
// BUILD: Gebäude bauen
// ─────────────────────────────────────────────────────────────────────────────

export async function startBuildingConstruction(userId, buildingTypeId, locationX, locationY) {
    return withTransaction(async (client) => {
        const building = await buildingRepo.findTypeById(buildingTypeId, client);
        if (!building) throw createServiceError('Gebäudetyp nicht gefunden', 404, 'BUILDING_TYPE_NOT_FOUND');

        const hasResources = await hasEnoughResources(
            userId,
            {
                money: building.money_cost,
                stone: building.stone_cost,
                steel: building.steel_cost,
                fuel: building.fuel_cost,
            },
            client
        );
        if (!hasResources) throw createServiceError('Nicht genug Ressourcen', 400, 'INSUFFICIENT_RESOURCES');

        if (building.power_consumption > 0) {
            const hasPower = await checkPowerAvailable(userId, building.power_consumption, client);
            if (!hasPower) throw createServiceError('Nicht genug Strom verfügbar', 400, 'INSUFFICIENT_POWER');
        }

        await deductResources(
            userId,
            {
                money: building.money_cost,
                stone: building.stone_cost,
                steel: building.steel_cost,
                fuel: building.fuel_cost,
            },
            client
        );

        const now = new Date();
        const constructionEndTime = new Date(now.getTime() + building.build_time_ticks * 60 * 1000);
        const createdBuilding = await buildingRepo.createConstructingBuilding(
            userId,
            buildingTypeId,
            now,
            constructionEndTime,
            locationX,
            locationY,
            client
        );

        return {
            success: true,
            building: createdBuilding,
            estimatedTime: building.build_time_ticks,
        };
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// UPGRADE: Gebäude upgraden
// ─────────────────────────────────────────────────────────────────────────────

export async function startUpgrade(userId, userBuildingId) {
    return withTransaction(async (client) => {
        const userBuilding = await buildingRepo.findUserBuildingWithType(userBuildingId, userId, client);
        if (!userBuilding) throw createServiceError('Gebäude nicht gefunden', 404, 'BUILDING_NOT_FOUND');

        const maxLevel = 4;
        if (userBuilding.level >= maxLevel) throw createServiceError('Maximales Level erreicht', 400, 'BUILDING_MAX_LEVEL');

        const nextLevelCosts = {
            money: Math.floor(userBuilding.money_cost * 1.5),
            stone: Math.floor(userBuilding.stone_cost * 1.5),
            steel: Math.floor(userBuilding.steel_cost * 1.5),
            fuel: Math.floor(userBuilding.fuel_cost * 1.5),
        };

        const hasResources = await hasEnoughResources(userId, nextLevelCosts, client);
        if (!hasResources) throw createServiceError('Nicht genug Ressourcen für Upgrade', 400, 'INSUFFICIENT_RESOURCES');

        await deductResources(userId, nextLevelCosts, client);

        const now = new Date();
        const upgradeEndTime = new Date(now.getTime() + userBuilding.build_time_ticks * 1500);

        await buildingRepo.markUpgradeStarted(userBuildingId, now, upgradeEndTime, client);

        return {
            success: true,
            newLevel: userBuilding.level + 1,
            estimatedTime: userBuilding.build_time_ticks * 1.5,
        };
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Ressourcen- und Energieprüfung
// ─────────────────────────────────────────────────────────────────────────────

export async function hasEnoughResources(userId, requiredResources, client) {
    const resources = (await resourcesRepo.findByUserId(userId, client)) ?? {
        geld: 0,
        stein: 0,
        stahl: 0,
        treibstoff: 0,
    };

    return (
        Number(resources.geld || 0) >= Number(requiredResources.money || 0) &&
        Number(resources.stein || 0) >= Number(requiredResources.stone || 0) &&
        Number(resources.stahl || 0) >= Number(requiredResources.steel || 0) &&
        Number(resources.treibstoff || 0) >= Number(requiredResources.fuel || 0)
    );
}

export async function checkPowerAvailable(userId, powerNeeded, client) {
    const { production, consumption } = await buildingRepo.findPowerSummaryByUser(userId, client);
    const availablePower = production - consumption;
    return availablePower >= powerNeeded;
}

export async function deductResources(userId, resources, client) {
    await resourcesRepo.deductResources(
        userId,
        resources.money || 0,
        resources.stone || 0,
        resources.steel || 0,
        resources.fuel || 0,
        client
    );
}

export async function addResources(userId, resources, client) {
    await resourcesRepo.addResources(
        userId,
        resources.money || 0,
        resources.stone || 0,
        resources.steel || 0,
        resources.fuel || 0,
        null,
        client
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// TICK: Ressourcenproduktion pro Tick
// ─────────────────────────────────────────────────────────────────────────────

export async function tickProduction(userId) {
    return withTransaction(async (client) => {
        const buildings = await buildingRepo.findBuildingsByUser(userId, client);
        const production = {
            money: 0,
            stone: 0,
            steel: 0,
            fuel: 0,
        };

        for (const building of buildings) {
            const count = Number(building.anzahl || 0);
            production.money += Number(building.money_production || 0) * count;
            production.stone += Number(building.stone_production || 0) * count;
            production.steel += Number(building.steel_production || 0) * count;
            production.fuel += Number(building.fuel_production || 0) * count;
        }

        await addResources(userId, production, client);
        return production;
    });
}

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

export async function getBuildingTypes() {
    return buildingRepo.findAllTypes();
}

export async function getMyBuildingsAndQueue(userId) {
    return withTransaction(async (client) => {
        await economyService.processFinishedQueue(userId, client);
        const buildings = await buildingRepo.findBuildingsByUser(userId, client);
        const queue = await buildingRepo.findQueueByUser(userId, client);
        return { buildings, queue };
    });
}

export async function getMyQueue(userId) {
    return withTransaction(async (client) => {
        await economyService.processFinishedQueue(userId, client);
        return buildingRepo.findQueueByUser(userId, client);
    });
}

export async function buildBuilding(userId, buildingTypeId, anzahl) {
    return withTransaction(async (client) => {
        const quantity = Number(anzahl);

        await economyService.applyProductionTicks(userId, client);
        await economyService.processFinishedQueue(userId, client);

        const bt = await buildingRepo.findTypeById(buildingTypeId, client);
        if (!bt) {
            throw createServiceError('Gebäudetyp nicht gefunden', 404, 'BUILDING_TYPE_NOT_FOUND');
        }

        if (bt.name === 'Rathaus') {
            throw createServiceError(
                'Das Rathaus wurde bereits beim Start gebaut.',
                400,
                'BUILDING_ALREADY_GRANTED'
            );
        }

        const builtBuildings = await buildingRepo.findBuildingsByUser(userId, client);

        const levelMeta = getLevelMeta(bt.name);
        if (levelMeta) {
            const builtLevels = getBuiltLevelSet(builtBuildings, levelMeta.baseName);

            if (builtLevels.has(levelMeta.level)) {
                throw createServiceError(`${bt.name} ist bereits gebaut.`, 400, 'BUILDING_ALREADY_BUILT');
            }

            if (levelMeta.level > 1 && !builtLevels.has(levelMeta.level - 1)) {
                throw createServiceError(
                    `Du musst zuerst ${levelMeta.baseName} Level ${levelMeta.level - 1} bauen.`,
                    400,
                    'BUILDING_PREREQUISITE_MISSING'
                );
            }
        }

        if (bt.category === 'military' || bt.category === 'government') {
            const missingProductionChains = getMissingProductionChains(builtBuildings);
            if (missingProductionChains.length > 0) {
                throw createServiceError(
                    `Für ${bt.category === 'military' ? 'Militär-' : 'Regierungs-'}gebäude brauchst du mindestens je ein Produktionsgebäude für alle Ressourcen. Fehlend: ${missingProductionChains.join(', ')}`,
                    400,
                    'BUILDING_RESOURCE_CHAIN_MISSING'
                );
            }
        }

        // Öl-Raffinerie: max. 5 pro vorhandener Ölpumpe
        if (bt.name === 'Öl-Raffinerie') {
            const oelpumpen = builtBuildings.find((b) => b.name === 'Ölpumpe');
            const pumpenCount = oelpumpen ? Number(oelpumpen.anzahl) : 0;
            if (pumpenCount === 0) {
                throw createServiceError(
                    'Du benötigst mindestens eine Ölpumpe, bevor du eine Öl-Raffinerie bauen kannst.',
                    400,
                    'BUILDING_PREREQUISITE_MISSING'
                );
            }
            const raffinerien = builtBuildings.find((b) => b.name === 'Öl-Raffinerie');
            const raffinerieCurrent = raffinerien ? Number(raffinerien.anzahl) : 0;
            if (raffinerieCurrent + quantity > pumpenCount * 5) {
                throw createServiceError(
                    `Du kannst maximal 5 Öl-Raffinerien pro Ölpumpe bauen. Ölpumpen: ${pumpenCount}, erlaubte Raffinerien: ${pumpenCount * 5}, bereits vorhanden: ${raffinerieCurrent}.`,
                    400,
                    'BUILDING_RATIO_EXCEEDED'
                );
            }
        }


            const strom = await economyService.getStromStatus(userId, client);
            const neuerVerbrauch = strom.verbrauch + Number(bt.power_consumption) * quantity;
            if (neuerVerbrauch > strom.produktion) {
                throw createServiceError(
                    'Nicht genug freier Strom für dieses Gebäude.',
                    400,
                    'BUILDING_NOT_ENOUGH_POWER'
                );
            }
        

        const resources = await resourcesRepo.findByUserIdLocked(userId, client);
        if (!resources) {
            throw createServiceError('Ressourcen nicht gefunden', 404, 'RESOURCES_NOT_FOUND');
        }

        // Für Infrastruktur- und Unterkunftsgebäude steigen die Kosten pro gebautem Exemplar um 3%
        const existingCount = SCALABLE_CATEGORIES.includes(bt.category)
            ? (builtBuildings.find((b) => Number(b.id) === Number(buildingTypeId))?.anzahl ?? 0)
            : 0;
        const useScaling = SCALABLE_CATEGORIES.includes(bt.category);

        const totalGeld = useScaling
            ? calculateScaledTotal(Number(bt.money_cost), existingCount, quantity, COST_SCALE_PER_BUILDING)
            : Number(bt.money_cost) * quantity;
        const totalStein = useScaling
            ? calculateScaledTotal(Number(bt.stone_cost), existingCount, quantity, COST_SCALE_PER_BUILDING)
            : Number(bt.stone_cost) * quantity;
        const totalStahl = useScaling
            ? calculateScaledTotal(Number(bt.steel_cost), existingCount, quantity, COST_SCALE_PER_BUILDING)
            : Number(bt.steel_cost) * quantity;
        const totalTreibstoff = useScaling
            ? calculateScaledTotal(Number(bt.fuel_cost), existingCount, quantity, COST_SCALE_PER_BUILDING)
            : Number(bt.fuel_cost) * quantity;

        if (Number(resources.geld) < totalGeld) {
            throw createServiceError(`Nicht genug Geld. Benötigt: ${totalGeld}`, 400, 'INSUFFICIENT_GELD');
        }
        if (Number(resources.stein) < totalStein) {
            throw createServiceError(
                `Nicht genug Stein. Benötigt: ${totalStein}`,
                400,
                'INSUFFICIENT_STEIN'
            );
        }
        if (Number(resources.stahl) < totalStahl) {
            throw createServiceError(
                `Nicht genug Stahl. Benötigt: ${totalStahl}`,
                400,
                'INSUFFICIENT_STAHL'
            );
        }
        if (Number(resources.treibstoff) < totalTreibstoff) {
            throw createServiceError(
                `Nicht genug Treibstoff. Benötigt: ${totalTreibstoff}`,
                400,
                'INSUFFICIENT_TREIBSTOFF'
            );
        }

        await resourcesRepo.deductResources(
            userId,
            totalGeld,
            totalStein,
            totalStahl,
            totalTreibstoff,
            client
        );

        const label = quantity > 1 ? `${quantity}x ${bt.name}` : bt.name;

        if (Number(bt.build_time_ticks) > 0) {
            const existing = await buildingRepo.findExistingQueueEntry(userId, buildingTypeId, client);
            if (existing) {
                throw createServiceError(
                    `${bt.name} ist bereits in der Bauwarteschlange.`,
                    400,
                    'BUILDING_ALREADY_QUEUED'
                );
            }

            const auftrag = await buildingRepo.createQueueEntry(
                userId,
                buildingTypeId,
                quantity,
                bt.build_time_ticks,
                client
            );

            const fertigStr = new Date(auftrag.fertig_am).toLocaleTimeString('de-DE', {
                hour: '2-digit',
                minute: '2-digit',
            });

            return {
                message: `${label} wird gebaut (fertig um ${fertigStr}).`,
                auftrag,
            };
        }

        await buildingRepo.upsertBuilding(userId, buildingTypeId, quantity, client);
        return { message: `${label} erfolgreich gebaut.` };
    });
}
