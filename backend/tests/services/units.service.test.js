import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../repositories/units.repository.js');
vi.mock('../../services/buildings.service.js');
vi.mock('../../repositories/transaction.repository.js');

import * as unitsRepo from '../../repositories/units.repository.js';
import * as buildingsService from '../../services/buildings.service.js';
import { withTransaction } from '../../repositories/transaction.repository.js';
import {
    getUserUnits,
    getUnitTypeByName,
    getUnitById,
    startTraining,
    moveUnits,
    attackUnits,
    getAllUnitTypes,
    getUnitsByCategory,
} from '../../services/units.service.js';

// withTransaction übergibt einen Fake-Client und führt den Callback direkt aus
withTransaction.mockImplementation(async (fn) => fn({}));

beforeEach(() => {
    vi.clearAllMocks();
    withTransaction.mockImplementation(async (fn) => fn({}));
});

// ---------------------------------------------------------------------------
// Einfache Getter
// ---------------------------------------------------------------------------
describe('getUserUnits', () => {
    it('delegiert an unitsRepo.findDetailedByUser', async () => {
        const fakeUnits = [{ id: 1, name: 'Infanterie', quantity: 10 }];
        unitsRepo.findDetailedByUser.mockResolvedValue(fakeUnits);

        const result = await getUserUnits(42);
        expect(unitsRepo.findDetailedByUser).toHaveBeenCalledWith(42);
        expect(result).toEqual(fakeUnits);
    });
});

describe('getUnitTypeByName', () => {
    it('delegiert an unitsRepo.findTypeByName', async () => {
        const fakeType = { id: 2, name: 'Panzer' };
        unitsRepo.findTypeByName.mockResolvedValue(fakeType);

        const result = await getUnitTypeByName('Panzer');
        expect(unitsRepo.findTypeByName).toHaveBeenCalledWith('Panzer');
        expect(result).toEqual(fakeType);
    });
});

describe('getUnitById', () => {
    it('delegiert an unitsRepo.findTypeById', async () => {
        unitsRepo.findTypeById.mockResolvedValue({ id: 3 });
        const result = await getUnitById(3);
        expect(unitsRepo.findTypeById).toHaveBeenCalledWith(3);
        expect(result).toEqual({ id: 3 });
    });
});

describe('getAllUnitTypes', () => {
    it('delegiert an unitsRepo.findAllTypes', async () => {
        unitsRepo.findAllTypes.mockResolvedValue([]);
        await getAllUnitTypes();
        expect(unitsRepo.findAllTypes).toHaveBeenCalled();
    });
});

describe('getUnitsByCategory', () => {
    it('delegiert an unitsRepo.findTypesByCategory', async () => {
        unitsRepo.findTypesByCategory.mockResolvedValue([]);
        await getUnitsByCategory('land');
        expect(unitsRepo.findTypesByCategory).toHaveBeenCalledWith('land');
    });
});

// ---------------------------------------------------------------------------
// startTraining
// ---------------------------------------------------------------------------
describe('startTraining', () => {
    const unitType = {
        id: 1,
        name: 'Infanterie',
        building_requirement: 'Kaserne',
        money_cost: 500,
        steel_cost: 50,
        fuel_cost: 10,
        training_time_ticks: 2,
    };

    it('wirft Fehler wenn Einheitentyp nicht gefunden', async () => {
        unitsRepo.findTypeById.mockResolvedValue(null);
        await expect(startTraining(1, 99)).rejects.toThrow('Einheitentyp nicht gefunden');
    });

    it('wirft Fehler wenn Gebäude nicht gebaut wurde', async () => {
        unitsRepo.findTypeById.mockResolvedValue(unitType);
        unitsRepo.findReadyBuildingCountByName.mockResolvedValue(0);

        await expect(startTraining(1, 1)).rejects.toThrow("Gebäude 'Kaserne' nicht gefunden");
    });

    it('wirft Fehler wenn nicht genug Ressourcen vorhanden', async () => {
        unitsRepo.findTypeById.mockResolvedValue(unitType);
        unitsRepo.findReadyBuildingCountByName.mockResolvedValue(1);
        buildingsService.hasEnoughResources.mockResolvedValue(false);

        await expect(startTraining(1, 1)).rejects.toThrow('Nicht genug Ressourcen');
    });

    it('erstellt neue Einheit wenn noch keine vorhanden ist', async () => {
        unitsRepo.findTypeById.mockResolvedValue(unitType);
        unitsRepo.findReadyBuildingCountByName.mockResolvedValue(1);
        buildingsService.hasEnoughResources.mockResolvedValue(true);
        buildingsService.deductResources.mockResolvedValue(undefined);
        unitsRepo.findUserUnitByType.mockResolvedValue(null);
        unitsRepo.createUserUnit.mockResolvedValue(undefined);

        const result = await startTraining(1, 1, 3);
        expect(unitsRepo.createUserUnit).toHaveBeenCalledWith(1, 1, 3, {});
        expect(result.success).toBe(true);
        expect(result.quantity).toBe(3);
    });

    it('erhöht bestehende Einheitenanzahl wenn Einheit schon vorhanden', async () => {
        unitsRepo.findTypeById.mockResolvedValue(unitType);
        unitsRepo.findReadyBuildingCountByName.mockResolvedValue(1);
        buildingsService.hasEnoughResources.mockResolvedValue(true);
        buildingsService.deductResources.mockResolvedValue(undefined);
        unitsRepo.findUserUnitByType.mockResolvedValue({ id: 7, quantity: 5 });
        unitsRepo.incrementUserUnitQuantity.mockResolvedValue(undefined);

        const result = await startTraining(1, 1, 2);
        expect(unitsRepo.incrementUserUnitQuantity).toHaveBeenCalledWith(1, 1, 2, {});
        expect(unitsRepo.createUserUnit).not.toHaveBeenCalled();
        expect(result.success).toBe(true);
    });

    it('berechnet Gesamtkosten korrekt für mehrere Einheiten', async () => {
        unitsRepo.findTypeById.mockResolvedValue(unitType);
        unitsRepo.findReadyBuildingCountByName.mockResolvedValue(1);
        buildingsService.hasEnoughResources.mockResolvedValue(true);
        buildingsService.deductResources.mockResolvedValue(undefined);
        unitsRepo.findUserUnitByType.mockResolvedValue(null);
        unitsRepo.createUserUnit.mockResolvedValue(undefined);

        const result = await startTraining(1, 1, 4);
        expect(result.totalCost).toEqual({ money: 2000, steel: 200, fuel: 40 });
        expect(result.trainingTime).toBe(8); // 2 ticks * 4 Einheiten
    });
});

// ---------------------------------------------------------------------------
// moveUnits
// ---------------------------------------------------------------------------
describe('moveUnits', () => {
    it('wirft Fehler wenn Einheit nicht gefunden', async () => {
        unitsRepo.findMovableUnit.mockResolvedValue(null);
        await expect(moveUnits(1, 99, 10, 20)).rejects.toThrow('Einheit nicht gefunden');
    });

    it('berechnet Reisezeit korrekt und aktualisiert Bewegung', async () => {
        unitsRepo.findMovableUnit.mockResolvedValue({
            id: 1,
            location_x: 0,
            location_y: 0,
            movement_speed: 10,
        });
        unitsRepo.setUnitMovement.mockResolvedValue(undefined);

        const result = await moveUnits(1, 1, 30, 40); // Distanz = 50
        expect(result.success).toBe(true);
        expect(result.distance).toBeCloseTo(50);
        expect(result.travelTime).toBeCloseTo(5); // 50 / 10
        expect(unitsRepo.setUnitMovement).toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// attackUnits
// ---------------------------------------------------------------------------
describe('attackUnits', () => {
    it('wirft Fehler wenn Angreifer nicht gefunden', async () => {
        unitsRepo.findAttackerUnit.mockResolvedValue(null);
        unitsRepo.findDefenderUnit.mockResolvedValue({ id: 2 });
        await expect(attackUnits(99, 2)).rejects.toThrow('Einheit nicht gefunden');
    });

    it('wirft Fehler wenn Verteidiger nicht gefunden', async () => {
        unitsRepo.findAttackerUnit.mockResolvedValue({ id: 1 });
        unitsRepo.findDefenderUnit.mockResolvedValue(null);
        await expect(attackUnits(1, 99)).rejects.toThrow('Einheit nicht gefunden');
    });

    it('berechnet Schaden und setzt Gesundheit korrekt', async () => {
        unitsRepo.findAttackerUnit.mockResolvedValue({ id: 1, attack_points: 100 });
        unitsRepo.findDefenderUnit.mockResolvedValue({
            id: 2,
            defense_points: 20,
            hitpoints: 200,
            health_percentage: 100,
        });
        unitsRepo.updateUnitHealth.mockResolvedValue(undefined);
        unitsRepo.addUnitExperience.mockResolvedValue(undefined);

        const result = await attackUnits(1, 2);
        // actualDamage = max(1, 100 - 20*0.5) = 90
        // healthLoss = (90/200)*100 = 45
        // newHealth = max(0, 100-45) = 55
        expect(result.success).toBe(true);
        expect(result.actualDamage).toBe(90);
        expect(result.targetHealth).toBe(55);
        expect(result.targetDestroyed).toBe(false);
        expect(unitsRepo.updateUnitHealth).toHaveBeenCalledWith(2, 55, {});
    });

    it('zerstört Einheit wenn Gesundheit auf 0 fällt', async () => {
        unitsRepo.findAttackerUnit.mockResolvedValue({ id: 1, attack_points: 1000 });
        unitsRepo.findDefenderUnit.mockResolvedValue({
            id: 2,
            defense_points: 0,
            hitpoints: 100,
            health_percentage: 10,
        });
        unitsRepo.updateUnitHealth.mockResolvedValue(undefined);
        unitsRepo.zeroUnitQuantity.mockResolvedValue(undefined);
        unitsRepo.addUnitExperience.mockResolvedValue(undefined);

        const result = await attackUnits(1, 2);
        expect(result.targetDestroyed).toBe(true);
        expect(unitsRepo.zeroUnitQuantity).toHaveBeenCalledWith(2, {});
    });

    it('gibt mindestens 1 Schadenspunkt wenn Angriff sehr schwach', async () => {
        unitsRepo.findAttackerUnit.mockResolvedValue({ id: 1, attack_points: 1 });
        unitsRepo.findDefenderUnit.mockResolvedValue({
            id: 2,
            defense_points: 1000,
            hitpoints: 100,
            health_percentage: 100,
        });
        unitsRepo.updateUnitHealth.mockResolvedValue(undefined);
        unitsRepo.addUnitExperience.mockResolvedValue(undefined);

        const result = await attackUnits(1, 2);
        expect(result.actualDamage).toBe(1);
    });
});
