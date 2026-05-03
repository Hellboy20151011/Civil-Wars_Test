/**
 * Buildings Service - Handhabt Gebäudebau, Upgrades und Ressourcenprüfung
 * Tick-System: 1 Tick = 10 Min (Production) / 1 Min (Dev)
 */

import * as buildingRepo from '../repositories/building.repository.js';
import * as resourcesRepo from '../repositories/resources.repository.js';
import { withTransaction } from '../repositories/transaction.repository.js';

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
        if (!building) throw new Error('Gebäudetyp nicht gefunden');

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
        if (!hasResources) throw new Error('Nicht genug Ressourcen');

        if (building.power_consumption > 0) {
            const hasPower = await checkPowerAvailable(userId, building.power_consumption, client);
            if (!hasPower) throw new Error('Nicht genug Strom verfügbar');
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
        if (!userBuilding) throw new Error('Gebäude nicht gefunden');

        const maxLevel = 4;
        if (userBuilding.level >= maxLevel) throw new Error('Maximales Level erreicht');

        const nextLevelCosts = {
            money: Math.floor(userBuilding.money_cost * 1.5),
            stone: Math.floor(userBuilding.stone_cost * 1.5),
            steel: Math.floor(userBuilding.steel_cost * 1.5),
            fuel: Math.floor(userBuilding.fuel_cost * 1.5),
        };

        const hasResources = await hasEnoughResources(userId, nextLevelCosts, client);
        if (!hasResources) throw new Error('Nicht genug Ressourcen für Upgrade');

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
