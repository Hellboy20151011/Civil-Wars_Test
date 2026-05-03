import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock-Module müssen vor dem Import des zu testenden Moduls registriert werden
vi.mock('../../repositories/building.repository.js');
vi.mock('../../repositories/resources.repository.js');

import * as buildingRepo from '../../repositories/building.repository.js';
import * as resourcesRepo from '../../repositories/resources.repository.js';
import {
    getStromStatus,
    getProductionPerTick,
    applyProductionTicks,
    processFinishedQueue,
} from '../../services/economy.service.js';

const TICK_MS = 60 * 1000;

beforeEach(() => {
    vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// getStromStatus
// ---------------------------------------------------------------------------
describe('getStromStatus', () => {
    it('gibt { produktion:0, verbrauch:0, frei:0 } zurück wenn keine Gebäude vorhanden', async () => {
        buildingRepo.findBuildingsByUser.mockResolvedValue([]);
        const result = await getStromStatus(1, {});
        expect(result).toEqual({ produktion: 0, verbrauch: 0, frei: 0 });
    });

    it('berechnet Stromproduktion und -verbrauch korrekt', async () => {
        buildingRepo.findBuildingsByUser.mockResolvedValue([
            { power_production: 50, power_consumption: 0,  anzahl: 2 }, // Kraftwerk ×2
            { power_production: 0,  power_consumption: 10, anzahl: 3 }, // Verbraucher ×3
        ]);
        const result = await getStromStatus(1, {});
        expect(result).toEqual({ produktion: 100, verbrauch: 30, frei: 70 });
    });

    it('frei kann negativ werden (Unterversorgung)', async () => {
        buildingRepo.findBuildingsByUser.mockResolvedValue([
            { power_production: 10, power_consumption: 50, anzahl: 1 },
        ]);
        const result = await getStromStatus(1, {});
        expect(result.frei).toBe(-40);
    });
});

// ---------------------------------------------------------------------------
// getProductionPerTick
// ---------------------------------------------------------------------------
describe('getProductionPerTick', () => {
    it('gibt Nullproduktion zurück wenn keine Gebäude vorhanden', async () => {
        buildingRepo.findBuildingsByUser.mockResolvedValue([]);
        const result = await getProductionPerTick(1, {});
        expect(result).toEqual({ geld: 0, stein: 0, stahl: 0, treibstoff: 0, bevoelkerung: 0 });
    });

    it('summiert Produktion über alle Gebäude und Anzahl', async () => {
        buildingRepo.findBuildingsByUser.mockResolvedValue([
            { money_production: 5000, stone_production: 10, steel_production: 7, fuel_production: 0, population: 100, anzahl: 2 },
            { money_production: 0,    stone_production: 0,  steel_production: 0, fuel_production: 10, population: 0,   anzahl: 1 },
        ]);
        const result = await getProductionPerTick(1, {});
        expect(result).toEqual({
            geld: 10000,
            stein: 20,
            stahl: 14,
            treibstoff: 10,
            bevoelkerung: 200,
        });
    });

    it('enthält kein eisen-Feld (Legacy entfernt)', async () => {
        buildingRepo.findBuildingsByUser.mockResolvedValue([]);
        const result = await getProductionPerTick(1, {});
        expect(result).not.toHaveProperty('eisen');
    });
});

// ---------------------------------------------------------------------------
// applyProductionTicks
// ---------------------------------------------------------------------------
describe('applyProductionTicks', () => {
    it('gibt 0 zurück wenn keine Ressourcen gefunden werden', async () => {
        resourcesRepo.findByUserIdLocked.mockResolvedValue(null);
        const ticks = await applyProductionTicks(1, {});
        expect(ticks).toBe(0);
        expect(resourcesRepo.addResources).not.toHaveBeenCalled();
    });

    it('gibt 0 zurück wenn last_updated weniger als 1 Tick zurückliegt', async () => {
        const recent = new Date(Date.now() - TICK_MS / 2);
        resourcesRepo.findByUserIdLocked.mockResolvedValue({ last_updated: recent });
        buildingRepo.findBuildingsByUser.mockResolvedValue([]);
        const ticks = await applyProductionTicks(1, {});
        expect(ticks).toBe(0);
    });

    it('berechnet korrekte Anzahl Ticks und ruft addResources auf', async () => {
        const past = new Date(Date.now() - 3 * TICK_MS - 100); // 3+ Ticks vergangen
        resourcesRepo.findByUserIdLocked.mockResolvedValue({ last_updated: past });
        resourcesRepo.addResources = vi.fn().mockResolvedValue(undefined);
        buildingRepo.findBuildingsByUser.mockResolvedValue([
            { money_production: 1000, stone_production: 5, steel_production: 3, fuel_production: 2, population: 0, anzahl: 1 },
        ]);

        const ticks = await applyProductionTicks(1, {});
        expect(ticks).toBe(3);
        expect(resourcesRepo.addResources).toHaveBeenCalledWith(
            1,
            3000, // geld × 3
            15,   // stein × 3
            9,    // stahl × 3
            6,    // treibstoff × 3
            expect.any(Date),
            {}
        );
    });
});

// ---------------------------------------------------------------------------
// processFinishedQueue
// ---------------------------------------------------------------------------
describe('processFinishedQueue', () => {
    it('gibt 0 zurück wenn die Queue leer ist', async () => {
        buildingRepo.findFinishedQueueEntries.mockResolvedValue([]);
        const count = await processFinishedQueue(1, {});
        expect(count).toBe(0);
        expect(buildingRepo.deleteFinishedQueueEntries).not.toHaveBeenCalled();
    });

    it('löscht fertige Einträge und gibt deren Anzahl zurück', async () => {
        buildingRepo.findFinishedQueueEntries.mockResolvedValue([{ id: 1 }, { id: 2 }]);
        buildingRepo.deleteFinishedQueueEntries = vi.fn().mockResolvedValue(undefined);
        const count = await processFinishedQueue(1, {});
        expect(count).toBe(2);
        expect(buildingRepo.deleteFinishedQueueEntries).toHaveBeenCalledWith(1, {});
    });
});
