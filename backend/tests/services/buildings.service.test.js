import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../repositories/building.repository.js');
vi.mock('../../repositories/resources.repository.js');
vi.mock('../../repositories/transaction.repository.js');
vi.mock('../../services/economy.service.js');

import * as buildingRepo from '../../repositories/building.repository.js';
import * as resourcesRepo from '../../repositories/resources.repository.js';
import { withTransaction } from '../../repositories/transaction.repository.js';
import * as economyService from '../../services/economy.service.js';
import {
    addResources,
    buildBuilding,
    checkPowerAvailable,
    deductResources,
    getBuildingById,
    getBuildingByName,
    getBuildingTypes,
    getMyBuildingsAndQueue,
    getMyQueue,
    getUserBuildings,
    hasEnoughResources,
    startBuildingConstruction,
    startUpgrade,
    tickProduction,
} from '../../services/buildings.service.js';

withTransaction.mockImplementation(async (fn) => fn({}));

beforeEach(() => {
    vi.clearAllMocks();
    withTransaction.mockImplementation(async (fn) => fn({}));
});

describe('basic getters', () => {
    it('delegates getUserBuildings', async () => {
        buildingRepo.findDetailedByUser.mockResolvedValue([{ id: 1 }]);
        await expect(getUserBuildings(5)).resolves.toEqual([{ id: 1 }]);
        expect(buildingRepo.findDetailedByUser).toHaveBeenCalledWith(5);
    });

    it('delegates getBuildingById', async () => {
        buildingRepo.findTypeById.mockResolvedValue({ id: 2 });
        await expect(getBuildingById(2)).resolves.toEqual({ id: 2 });
    });

    it('delegates getBuildingByName', async () => {
        buildingRepo.findTypeByName.mockResolvedValue({ id: 3, name: 'Rathaus' });
        await expect(getBuildingByName('Rathaus')).resolves.toEqual({ id: 3, name: 'Rathaus' });
    });

    it('delegates getBuildingTypes', async () => {
        buildingRepo.findAllTypes.mockResolvedValue([{ id: 1 }]);
        await expect(getBuildingTypes()).resolves.toEqual([{ id: 1 }]);
    });
});

describe('resource helpers', () => {
    it('hasEnoughResources returns true when all resources are sufficient', async () => {
        resourcesRepo.findByUserId.mockResolvedValue({ geld: 100, stein: 50, stahl: 30, treibstoff: 20 });
        await expect(hasEnoughResources(1, { money: 100, stone: 10, steel: 10, fuel: 10 }, {})).resolves.toBe(true);
    });

    it('hasEnoughResources returns false when any resource is missing', async () => {
        resourcesRepo.findByUserId.mockResolvedValue({ geld: 99, stein: 50, stahl: 30, treibstoff: 20 });
        await expect(hasEnoughResources(1, { money: 100 }, {})).resolves.toBe(false);
    });

    it('checkPowerAvailable compares summary against needed power', async () => {
        buildingRepo.findPowerSummaryByUser.mockResolvedValue({ production: 20, consumption: 5 });
        await expect(checkPowerAvailable(1, 10, {})).resolves.toBe(true);
        await expect(checkPowerAvailable(1, 16, {})).resolves.toBe(false);
    });

    it('deductResources forwards normalized values', async () => {
        resourcesRepo.deductResources.mockResolvedValue(undefined);
        await deductResources(1, { money: 10, steel: 2 }, {});
        expect(resourcesRepo.deductResources).toHaveBeenCalledWith(1, 10, 0, 2, 0, {});
    });

    it('addResources forwards normalized values', async () => {
        resourcesRepo.addResources.mockResolvedValue(undefined);
        await addResources(1, { money: 10, fuel: 4 }, {});
        expect(resourcesRepo.addResources).toHaveBeenCalledWith(1, 10, 0, 0, 4, null, {});
    });
});

describe('startBuildingConstruction', () => {
    it('fails when building type is missing', async () => {
        buildingRepo.findTypeById.mockResolvedValue(null);
        await expect(startBuildingConstruction(1, 99, 0, 0)).rejects.toMatchObject({ code: 'BUILDING_TYPE_NOT_FOUND' });
    });

    it('fails when resources are insufficient', async () => {
        buildingRepo.findTypeById.mockResolvedValue({ id: 1, money_cost: 10, stone_cost: 0, steel_cost: 0, fuel_cost: 0, power_consumption: 0 });
        resourcesRepo.findByUserId.mockResolvedValue({ geld: 0, stein: 0, stahl: 0, treibstoff: 0 });
        await expect(startBuildingConstruction(1, 1, 0, 0)).rejects.toMatchObject({ code: 'INSUFFICIENT_RESOURCES' });
    });

    it('fails when required power is unavailable', async () => {
        buildingRepo.findTypeById.mockResolvedValue({ id: 1, money_cost: 10, stone_cost: 0, steel_cost: 0, fuel_cost: 0, power_consumption: 10 });
        resourcesRepo.findByUserId.mockResolvedValue({ geld: 10, stein: 0, stahl: 0, treibstoff: 0 });
        buildingRepo.findPowerSummaryByUser.mockResolvedValue({ production: 5, consumption: 0 });
        await expect(startBuildingConstruction(1, 1, 0, 0)).rejects.toMatchObject({ code: 'INSUFFICIENT_POWER' });
    });

    it('creates a constructing building on success', async () => {
        const created = { id: 7, building_type_id: 1 };
        buildingRepo.findTypeById.mockResolvedValue({ id: 1, money_cost: 10, stone_cost: 1, steel_cost: 2, fuel_cost: 3, power_consumption: 0, build_time_ticks: 2 });
        resourcesRepo.findByUserId.mockResolvedValue({ geld: 20, stein: 5, stahl: 5, treibstoff: 5 });
        resourcesRepo.deductResources.mockResolvedValue(undefined);
        buildingRepo.createConstructingBuilding.mockResolvedValue(created);

        const result = await startBuildingConstruction(1, 1, 4, 6);

        expect(resourcesRepo.deductResources).toHaveBeenCalled();
        expect(buildingRepo.createConstructingBuilding).toHaveBeenCalledWith(1, 1, expect.any(Date), expect.any(Date), 4, 6, {});
        expect(result).toEqual({ success: true, building: created, estimatedTime: 2 });
    });
});

describe('startUpgrade', () => {
    it('fails when the building does not exist', async () => {
        buildingRepo.findUserBuildingWithType.mockResolvedValue(null);
        await expect(startUpgrade(1, 7)).rejects.toMatchObject({ code: 'BUILDING_NOT_FOUND' });
    });

    it('fails when maximum level is reached', async () => {
        buildingRepo.findUserBuildingWithType.mockResolvedValue({ level: 4 });
        await expect(startUpgrade(1, 7)).rejects.toMatchObject({ code: 'BUILDING_MAX_LEVEL' });
    });

    it('starts upgrade when resources are sufficient', async () => {
        buildingRepo.findUserBuildingWithType.mockResolvedValue({
            id: 7,
            level: 2,
            money_cost: 100,
            stone_cost: 50,
            steel_cost: 20,
            fuel_cost: 10,
            build_time_ticks: 4,
        });
        resourcesRepo.findByUserId.mockResolvedValue({ geld: 1000, stein: 1000, stahl: 1000, treibstoff: 1000 });
        resourcesRepo.deductResources.mockResolvedValue(undefined);
        buildingRepo.markUpgradeStarted.mockResolvedValue(undefined);

        const result = await startUpgrade(1, 7);

        expect(buildingRepo.markUpgradeStarted).toHaveBeenCalledWith(7, expect.any(Date), expect.any(Date), {});
        expect(result).toEqual({ success: true, newLevel: 3, estimatedTime: 6 });
    });
});

describe('tick and queue helpers', () => {
    it('tickProduction aggregates production and adds resources', async () => {
        buildingRepo.findBuildingsByUser.mockResolvedValue([
            { anzahl: 2, money_production: 10, stone_production: 5, steel_production: 1, fuel_production: 0 },
            { anzahl: 1, money_production: 0, stone_production: 0, steel_production: 0, fuel_production: 7 },
        ]);
        resourcesRepo.addResources.mockResolvedValue(undefined);

        await expect(tickProduction(1)).resolves.toEqual({ money: 20, stone: 10, steel: 2, fuel: 7 });
        expect(resourcesRepo.addResources).toHaveBeenCalledWith(1, 20, 10, 2, 7, null, {});
    });

    it('getMyBuildingsAndQueue processes finished queue before loading data', async () => {
        economyService.processFinishedQueue.mockResolvedValue(undefined);
        buildingRepo.findBuildingsByUser.mockResolvedValue([{ id: 1 }]);
        buildingRepo.findQueueByUser.mockResolvedValue([{ id: 2 }]);

        await expect(getMyBuildingsAndQueue(1)).resolves.toEqual({ buildings: [{ id: 1 }], queue: [{ id: 2 }] });
        expect(economyService.processFinishedQueue).toHaveBeenCalledWith(1, {});
    });

    it('getMyQueue processes finished queue before returning the queue', async () => {
        economyService.processFinishedQueue.mockResolvedValue(undefined);
        buildingRepo.findQueueByUser.mockResolvedValue([{ id: 2 }]);

        await expect(getMyQueue(1)).resolves.toEqual([{ id: 2 }]);
        expect(economyService.processFinishedQueue).toHaveBeenCalledWith(1, {});
    });
});

describe('buildBuilding', () => {
    const baseResources = { geld: 1000, stein: 1000, stahl: 1000, treibstoff: 1000 };

    it('rejects Rathaus because it is already granted', async () => {
        economyService.applyProductionTicks.mockResolvedValue(undefined);
        economyService.processFinishedQueue.mockResolvedValue(undefined);
        buildingRepo.findTypeById.mockResolvedValue({ id: 1, name: 'Rathaus' });

        await expect(buildBuilding(1, 1, 1)).rejects.toMatchObject({ code: 'BUILDING_ALREADY_GRANTED' });
    });

    it('rejects duplicate level buildings', async () => {
        economyService.applyProductionTicks.mockResolvedValue(undefined);
        economyService.processFinishedQueue.mockResolvedValue(undefined);
        buildingRepo.findTypeById.mockResolvedValue({ id: 2, name: 'Kaserne Level 2', category: 'military' });
        buildingRepo.findBuildingsByUser.mockResolvedValue([{ name: 'Kaserne Level 2', anzahl: 1 }]);

        await expect(buildBuilding(1, 2, 1)).rejects.toMatchObject({ code: 'BUILDING_ALREADY_BUILT' });
    });

    it('rejects missing level prerequisite', async () => {
        economyService.applyProductionTicks.mockResolvedValue(undefined);
        economyService.processFinishedQueue.mockResolvedValue(undefined);
        buildingRepo.findTypeById.mockResolvedValue({ id: 2, name: 'Kaserne Level 2', category: 'military' });
        buildingRepo.findBuildingsByUser.mockResolvedValue([{ name: 'Kaserne Level 3', anzahl: 1 }]);

        await expect(buildBuilding(1, 2, 1)).rejects.toMatchObject({ code: 'BUILDING_PREREQUISITE_MISSING' });
    });

    it('rejects military buildings when production chains are missing', async () => {
        economyService.applyProductionTicks.mockResolvedValue(undefined);
        economyService.processFinishedQueue.mockResolvedValue(undefined);
        buildingRepo.findTypeById.mockResolvedValue({ id: 3, name: 'Kaserne', category: 'military' });
        buildingRepo.findBuildingsByUser.mockResolvedValue([]);

        await expect(buildBuilding(1, 3, 1)).rejects.toMatchObject({ code: 'BUILDING_RESOURCE_CHAIN_MISSING' });
    });

    it('rejects oil refinery when the pump ratio is exceeded', async () => {
        economyService.applyProductionTicks.mockResolvedValue(undefined);
        economyService.processFinishedQueue.mockResolvedValue(undefined);
        buildingRepo.findTypeById.mockResolvedValue({ id: 4, name: 'Öl-Raffinerie', category: 'infrastructure' });
        buildingRepo.findBuildingsByUser.mockResolvedValue([
            { name: 'Ölpumpe', anzahl: 1 },
            { name: 'Öl-Raffinerie', anzahl: 5 },
        ]);

        await expect(buildBuilding(1, 4, 1)).rejects.toMatchObject({ code: 'BUILDING_RATIO_EXCEEDED' });
    });

    it('rejects building when free power is insufficient', async () => {
        economyService.applyProductionTicks.mockResolvedValue(undefined);
        economyService.processFinishedQueue.mockResolvedValue(undefined);
        economyService.getStromStatus.mockResolvedValue({ produktion: 10, verbrauch: 9 });
        buildingRepo.findTypeById.mockResolvedValue({
            id: 5,
            name: 'Radar',
            category: 'infrastructure',
            power_consumption: 2,
            money_cost: 10,
            stone_cost: 0,
            steel_cost: 0,
            fuel_cost: 0,
        });
        buildingRepo.findBuildingsByUser.mockResolvedValue([{ name: 'Wohnhaus', anzahl: 1 }, { name: 'Steinbruch', anzahl: 1 }, { name: 'Stahlwerk', anzahl: 1 }, { name: 'Öl-Raffinerie', anzahl: 1 }]);

        await expect(buildBuilding(1, 5, 1)).rejects.toMatchObject({ code: 'BUILDING_NOT_ENOUGH_POWER' });
    });

    it('queues timed buildings and rejects duplicate queue entries', async () => {
        economyService.applyProductionTicks.mockResolvedValue(undefined);
        economyService.processFinishedQueue.mockResolvedValue(undefined);
        economyService.getStromStatus.mockResolvedValue({ produktion: 100, verbrauch: 0 });
        buildingRepo.findTypeById.mockResolvedValue({
            id: 6,
            name: 'Fabrik',
            category: 'infrastructure',
            power_consumption: 1,
            money_cost: 10,
            stone_cost: 0,
            steel_cost: 0,
            fuel_cost: 0,
            build_time_ticks: 2,
        });
        buildingRepo.findBuildingsByUser.mockResolvedValue([{ name: 'Wohnhaus', anzahl: 1 }, { name: 'Steinbruch', anzahl: 1 }, { name: 'Stahlwerk', anzahl: 1 }, { name: 'Öl-Raffinerie', anzahl: 1 }]);
        resourcesRepo.findByUserIdLocked.mockResolvedValue(baseResources);
        resourcesRepo.deductResources.mockResolvedValue(undefined);
        buildingRepo.findExistingQueueEntry.mockResolvedValue({ id: 99 });

        await expect(buildBuilding(1, 6, 1)).rejects.toMatchObject({ code: 'BUILDING_ALREADY_QUEUED' });

        buildingRepo.findExistingQueueEntry.mockResolvedValue(null);
        buildingRepo.createQueueEntry.mockResolvedValue({ fertig_am: '2026-01-01T10:15:00.000Z' });
        await expect(buildBuilding(1, 6, 1)).resolves.toEqual({
            message: expect.stringContaining('Fabrik wird gebaut'),
            auftrag: { fertig_am: '2026-01-01T10:15:00.000Z' },
        });
    });

    it('builds instant buildings immediately', async () => {
        economyService.applyProductionTicks.mockResolvedValue(undefined);
        economyService.processFinishedQueue.mockResolvedValue(undefined);
        economyService.getStromStatus.mockResolvedValue({ produktion: 100, verbrauch: 0 });
        buildingRepo.findTypeById.mockResolvedValue({
            id: 7,
            name: 'Wohnhaus',
            category: 'housing',
            power_consumption: 0,
            money_cost: 5,
            stone_cost: 0,
            steel_cost: 0,
            fuel_cost: 0,
            build_time_ticks: 0,
        });
        buildingRepo.findBuildingsByUser.mockResolvedValue([]);
        resourcesRepo.findByUserIdLocked.mockResolvedValue(baseResources);
        resourcesRepo.deductResources.mockResolvedValue(undefined);
        buildingRepo.upsertBuilding.mockResolvedValue(undefined);

        await expect(buildBuilding(1, 7, 2)).resolves.toEqual({ message: '2x Wohnhaus erfolgreich gebaut.' });
        expect(buildingRepo.upsertBuilding).toHaveBeenCalledWith(1, 7, 2, {});
    });

    it('rejects when building type is not found', async () => {
        economyService.applyProductionTicks.mockResolvedValue(undefined);
        economyService.processFinishedQueue.mockResolvedValue(undefined);
        buildingRepo.findTypeById.mockResolvedValue(null);

        await expect(buildBuilding(1, 99, 1)).rejects.toMatchObject({ code: 'BUILDING_TYPE_NOT_FOUND' });
    });

    it('rejects Öl-Raffinerie when no Ölpumpe exists', async () => {
        economyService.applyProductionTicks.mockResolvedValue(undefined);
        economyService.processFinishedQueue.mockResolvedValue(undefined);
        buildingRepo.findTypeById.mockResolvedValue({ id: 4, name: 'Öl-Raffinerie', category: 'infrastructure' });
        buildingRepo.findBuildingsByUser.mockResolvedValue([]);

        await expect(buildBuilding(1, 4, 1)).rejects.toMatchObject({ code: 'BUILDING_PREREQUISITE_MISSING' });
    });

    it('rejects when resources record is not found', async () => {
        economyService.applyProductionTicks.mockResolvedValue(undefined);
        economyService.processFinishedQueue.mockResolvedValue(undefined);
        economyService.getStromStatus.mockResolvedValue({ produktion: 100, verbrauch: 0 });
        buildingRepo.findTypeById.mockResolvedValue({
            id: 8, name: 'Wohnhaus', category: 'housing',
            power_consumption: 0, build_time_ticks: 0,
            money_cost: 100, stone_cost: 100, steel_cost: 100, fuel_cost: 100,
        });
        buildingRepo.findBuildingsByUser.mockResolvedValue([]);
        resourcesRepo.findByUserIdLocked.mockResolvedValue(null);

        await expect(buildBuilding(1, 8, 1)).rejects.toMatchObject({ code: 'RESOURCES_NOT_FOUND' });
    });

    it('rejects when geld is insufficient', async () => {
        economyService.applyProductionTicks.mockResolvedValue(undefined);
        economyService.processFinishedQueue.mockResolvedValue(undefined);
        economyService.getStromStatus.mockResolvedValue({ produktion: 100, verbrauch: 0 });
        buildingRepo.findTypeById.mockResolvedValue({
            id: 8, name: 'Wohnhaus', category: 'housing',
            power_consumption: 0, build_time_ticks: 0,
            money_cost: 100, stone_cost: 100, steel_cost: 100, fuel_cost: 100,
        });
        buildingRepo.findBuildingsByUser.mockResolvedValue([]);
        resourcesRepo.findByUserIdLocked.mockResolvedValue({ geld: 99, stein: 100, stahl: 100, treibstoff: 100 });

        await expect(buildBuilding(1, 8, 1)).rejects.toMatchObject({ code: 'INSUFFICIENT_GELD' });
    });

    it('rejects when stein is insufficient', async () => {
        economyService.applyProductionTicks.mockResolvedValue(undefined);
        economyService.processFinishedQueue.mockResolvedValue(undefined);
        economyService.getStromStatus.mockResolvedValue({ produktion: 100, verbrauch: 0 });
        buildingRepo.findTypeById.mockResolvedValue({
            id: 8, name: 'Wohnhaus', category: 'housing',
            power_consumption: 0, build_time_ticks: 0,
            money_cost: 100, stone_cost: 100, steel_cost: 100, fuel_cost: 100,
        });
        buildingRepo.findBuildingsByUser.mockResolvedValue([]);
        resourcesRepo.findByUserIdLocked.mockResolvedValue({ geld: 100, stein: 99, stahl: 100, treibstoff: 100 });

        await expect(buildBuilding(1, 8, 1)).rejects.toMatchObject({ code: 'INSUFFICIENT_STEIN' });
    });

    it('rejects when stahl is insufficient', async () => {
        economyService.applyProductionTicks.mockResolvedValue(undefined);
        economyService.processFinishedQueue.mockResolvedValue(undefined);
        economyService.getStromStatus.mockResolvedValue({ produktion: 100, verbrauch: 0 });
        buildingRepo.findTypeById.mockResolvedValue({
            id: 8, name: 'Wohnhaus', category: 'housing',
            power_consumption: 0, build_time_ticks: 0,
            money_cost: 100, stone_cost: 100, steel_cost: 100, fuel_cost: 100,
        });
        buildingRepo.findBuildingsByUser.mockResolvedValue([]);
        resourcesRepo.findByUserIdLocked.mockResolvedValue({ geld: 100, stein: 100, stahl: 99, treibstoff: 100 });

        await expect(buildBuilding(1, 8, 1)).rejects.toMatchObject({ code: 'INSUFFICIENT_STAHL' });
    });

    it('rejects when treibstoff is insufficient', async () => {
        economyService.applyProductionTicks.mockResolvedValue(undefined);
        economyService.processFinishedQueue.mockResolvedValue(undefined);
        economyService.getStromStatus.mockResolvedValue({ produktion: 100, verbrauch: 0 });
        buildingRepo.findTypeById.mockResolvedValue({
            id: 8, name: 'Wohnhaus', category: 'housing',
            power_consumption: 0, build_time_ticks: 0,
            money_cost: 100, stone_cost: 100, steel_cost: 100, fuel_cost: 100,
        });
        buildingRepo.findBuildingsByUser.mockResolvedValue([]);
        resourcesRepo.findByUserIdLocked.mockResolvedValue({ geld: 100, stein: 100, stahl: 100, treibstoff: 99 });

        await expect(buildBuilding(1, 8, 1)).rejects.toMatchObject({ code: 'INSUFFICIENT_TREIBSTOFF' });
    });
});