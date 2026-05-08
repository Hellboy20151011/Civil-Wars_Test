import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../repositories/npc.repository.js');
vi.mock('../../repositories/building.repository.js');
vi.mock('../../repositories/resources.repository.js');
vi.mock('../../repositories/units.repository.js');
vi.mock('../../repositories/player.repository.js');
vi.mock('../../services/buildings.service.js');
vi.mock('../../services/units.service.js');
vi.mock('../../services/combat.service.js');
vi.mock('../../logger.js', () => ({
    logger: {
        info: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

import * as npcRepo from '../../repositories/npc.repository.js';
import * as buildingRepo from '../../repositories/building.repository.js';
import * as resourcesRepo from '../../repositories/resources.repository.js';
import * as unitsRepo from '../../repositories/units.repository.js';
import * as playerRepo from '../../repositories/player.repository.js';
import * as buildingService from '../../services/buildings.service.js';
import * as unitsService from '../../services/units.service.js';
import * as combatService from '../../services/combat.service.js';
import { logger } from '../../logger.js';
import { tickAllNpcs, _resetAttackCooldownsForTests } from '../../services/npc.service.js';

beforeEach(() => {
    vi.clearAllMocks();
    _resetAttackCooldownsForTests(); // Angriffs-Cooldown zwischen Tests zurücksetzen
});

describe('tickAllNpcs', () => {
    it('does nothing when no active NPCs exist', async () => {
        npcRepo.findActiveNpcs.mockResolvedValue([]);

        await tickAllNpcs();

        expect(resourcesRepo.findByUserId).not.toHaveBeenCalled();
        expect(logger.debug).not.toHaveBeenCalled();
    });

    it('starts defensive build priority when no active construction exists', async () => {
        npcRepo.findActiveNpcs.mockResolvedValue([
            { id: 11, npc_type: 'defensive', koordinate_x: 5, koordinate_y: 5 },
        ]);
        resourcesRepo.findByUserId.mockResolvedValue({ geld: 100_000, stein: 500, stahl: 200 });
        buildingRepo.findDetailedByUser.mockResolvedValue([]);
        buildingRepo.findPowerSummaryByUser.mockResolvedValue({ production: 0, consumption: 10 });
        buildingRepo.findTypeByName.mockResolvedValue({ id: 1, name: 'Kraftwerk' });
        buildingService.startBuildingConstruction.mockResolvedValue({ success: true });

        await tickAllNpcs();

        expect(buildingRepo.findTypeByName).toHaveBeenCalledWith('Kraftwerk');
        expect(buildingService.startBuildingConstruction).toHaveBeenCalledWith(11, 1, expect.any(Number), expect.any(Number));
    });

    it('builds power plant when free power is exactly zero', async () => {
        npcRepo.findActiveNpcs.mockResolvedValue([
            { id: 12, npc_type: 'defensive', koordinate_x: 5, koordinate_y: 5 },
        ]);
        resourcesRepo.findByUserId.mockResolvedValue({ geld: 300_000, stein: 5_000, stahl: 2_000 });
        buildingRepo.findDetailedByUser.mockResolvedValue([]);
        buildingRepo.findPowerSummaryByUser.mockResolvedValue({ production: 0, consumption: 0 });
        buildingRepo.findTypeByName.mockResolvedValue({ id: 1, name: 'Kraftwerk' });
        buildingService.startBuildingConstruction.mockResolvedValue({ success: true });

        await tickAllNpcs();

        expect(buildingRepo.findTypeByName).toHaveBeenCalledWith('Kraftwerk');
        expect(buildingService.startBuildingConstruction).toHaveBeenCalledWith(12, 1, expect.any(Number), expect.any(Number));
    });

    it('builds power plant when free power is low but still positive', async () => {
        npcRepo.findActiveNpcs.mockResolvedValue([
            { id: 13, npc_type: 'defensive', koordinate_x: 5, koordinate_y: 5 },
        ]);
        resourcesRepo.findByUserId.mockResolvedValue({ geld: 300_000, stein: 5_000, stahl: 2_000 });
        buildingRepo.findDetailedByUser.mockResolvedValue([]);
        buildingRepo.findPowerSummaryByUser.mockResolvedValue({ production: 54, consumption: 50 }); // stromFrei = 4
        buildingRepo.findTypeByName.mockResolvedValue({ id: 1, name: 'Kraftwerk' });
        buildingService.startBuildingConstruction.mockResolvedValue({ success: true });

        await tickAllNpcs();

        expect(buildingRepo.findTypeByName).toHaveBeenCalledWith('Kraftwerk');
        expect(buildingService.startBuildingConstruction).toHaveBeenCalledWith(13, 1, expect.any(Number), expect.any(Number));
    });

    it('trains infantry and launches attack for aggressive NPCs', async () => {
        npcRepo.findActiveNpcs.mockResolvedValue([
            { id: 21, npc_type: 'aggressive', koordinate_x: 0, koordinate_y: 0 },
        ]);

        // Produktionsziele ≥ 50 % erfüllt:
        // 25× Steinbruch (25×10=250t ≥ 500×0.5), 25× Stahlwerk (25×7=175t ≥ 350×0.5),
        // 25× Öl-Raffinerie (25×10=250L ≥ 500×0.5), 5× Ölpumpe
        resourcesRepo.findByUserId.mockResolvedValue({
            geld: 500_000, stein: 10_000, stahl: 10_000, treibstoff: 3_000,
        });
        buildingRepo.findDetailedByUser.mockResolvedValue([
            ...Array.from({ length: 25 }, (_, i) => ({ is_constructing: false, name: 'Steinbruch',    location_x: i, location_y: 0 })),
            ...Array.from({ length: 25 }, (_, i) => ({ is_constructing: false, name: 'Stahlwerk',     location_x: i, location_y: 1 })),
            ...Array.from({ length:  5 }, (_, i) => ({ is_constructing: false, name: 'Ölpumpe',       location_x: i, location_y: 2 })),
            ...Array.from({ length: 25 }, (_, i) => ({ is_constructing: false, name: 'Öl-Raffinerie', location_x: i, location_y: 3 })),
            { is_constructing: true, name: 'Kaserne Level 1', location_x: 0, location_y: 4 },
        ]);
        buildingRepo.findPowerSummaryByUser.mockResolvedValue({ production: 100, consumption: 20 });

        unitsRepo.findTypeByName.mockResolvedValue({ id: 3, name: 'Soldat' });
        unitsService.startTraining.mockResolvedValue({ success: true });

        unitsRepo.findDetailedByUser.mockResolvedValue([
            { id: 901, category: 'infantry', is_moving: false, quantity: 12 },
        ]);
        playerRepo.findActiveHumanTargetsForMap.mockResolvedValue([
            { id: 30, koordinate_x: 10, koordinate_y: 0 },
            { id: 31, koordinate_x: 20, koordinate_y: 0 },
        ]);
        combatService.launchAttack.mockResolvedValue({ success: true });

        await tickAllNpcs();

        expect(unitsService.startTraining).toHaveBeenCalledWith(21, 3, 5);
        // Ziel 30 (nächster): floor(12 * 0.5) = 6 Einheiten
        expect(combatService.launchAttack).toHaveBeenCalledWith(
            21,
            30,
            [{ userUnitId: 901, quantity: 6 }]
        );
        // Ziel 31 (weiter): verbleibend 6, max(5, floor(6 * 0.5)) = 5 Einheiten
        expect(combatService.launchAttack).toHaveBeenCalledWith(
            21,
            31,
            [{ userUnitId: 901, quantity: 5 }]
        );
        expect(combatService.launchAttack).toHaveBeenCalledTimes(2);
    });

    it('builds oil pump before barracks for aggressive NPCs', async () => {
        npcRepo.findActiveNpcs.mockResolvedValue([
            { id: 31, npc_type: 'aggressive', koordinate_x: 0, koordinate_y: 0 },
        ]);

        resourcesRepo.findByUserId.mockResolvedValue({ geld: 500_000, stein: 10_000, stahl: 10_000 });
        // Phase-1-Gebäude Wohnhaus/Steinbruch/Stahlwerk bereits vorhanden – nächste Phase: Ölpumpe
        buildingRepo.findDetailedByUser.mockResolvedValue([
            { is_constructing: false, name: 'Wohnhaus',   location_x: 0, location_y: 0 },
            { is_constructing: false, name: 'Steinbruch', location_x: 1, location_y: 0 },
            { is_constructing: false, name: 'Stahlwerk',  location_x: 2, location_y: 0 },
        ]);
        buildingRepo.findPowerSummaryByUser.mockResolvedValue({ production: 100, consumption: 20 });

        buildingRepo.findTypeByName.mockImplementation(async (name) => ({ id: ({ 'Ölpumpe': 5, 'Kaserne Level 1': 6 }[name] ?? 1), name }));
        buildingService.startBuildingConstruction.mockResolvedValue({ success: true });

        unitsRepo.findTypeByName.mockResolvedValue({ id: 3, name: 'Soldat' });
        unitsService.startTraining.mockResolvedValue({ success: true });
        unitsRepo.findDetailedByUser.mockResolvedValue([]);
        playerRepo.findActiveHumanTargetsForMap.mockResolvedValue([]);

        await tickAllNpcs();

        expect(buildingRepo.findTypeByName).toHaveBeenCalledWith('Ölpumpe');
        expect(buildingService.startBuildingConstruction).toHaveBeenCalledWith(31, 5, expect.any(Number), expect.any(Number));
        expect(buildingRepo.findTypeByName).not.toHaveBeenCalledWith('Kaserne Level 1');
    });

    it('allows defensive NPCs to build land defense', async () => {
        npcRepo.findActiveNpcs.mockResolvedValue([
            { id: 32, npc_type: 'defensive', koordinate_x: 5, koordinate_y: 5 },
        ]);

        resourcesRepo.findByUserId.mockResolvedValue({ geld: 300_000, stein: 5_000, stahl: 2_000 });
        // Alle Phase-1-Ressourcengebäude bereits vorhanden – nächste: Landverteidigung
        buildingRepo.findDetailedByUser.mockResolvedValue([
            { is_constructing: false, name: 'Wohnhaus',      location_x: 0, location_y: 0 },
            { is_constructing: false, name: 'Steinbruch',    location_x: 1, location_y: 0 },
            { is_constructing: false, name: 'Stahlwerk',     location_x: 2, location_y: 0 },
            { is_constructing: false, name: 'Ölpumpe',       location_x: 3, location_y: 0 },
            { is_constructing: false, name: 'Öl-Raffinerie', location_x: 4, location_y: 0 },
        ]);
        buildingRepo.findPowerSummaryByUser.mockResolvedValue({ production: 100, consumption: 20 });

        buildingRepo.findTypeByName.mockImplementation(async (name) => ({ id: ({ 'Landverteidigung Level 1': 7 }[name] ?? 1), name }));
        buildingService.startBuildingConstruction.mockResolvedValue({ success: true });

        await tickAllNpcs();

        expect(buildingRepo.findTypeByName).toHaveBeenCalledWith('Landverteidigung Level 1');
        expect(buildingService.startBuildingConstruction).toHaveBeenCalledWith(32, 7, expect.any(Number), expect.any(Number));
    });

    it('skips attack when NPC attack cooldown is active', async () => {
        npcRepo.findActiveNpcs.mockResolvedValue([
            { id: 21, npc_type: 'aggressive', koordinate_x: 0, koordinate_y: 0 },
        ]);

        const productionReadyBuildings = [
            ...Array.from({ length: 25 }, (_, i) => ({ is_constructing: false, name: 'Steinbruch',    location_x: i, location_y: 0 })),
            ...Array.from({ length: 25 }, (_, i) => ({ is_constructing: false, name: 'Stahlwerk',     location_x: i, location_y: 1 })),
            ...Array.from({ length:  5 }, (_, i) => ({ is_constructing: false, name: 'Ölpumpe',       location_x: i, location_y: 2 })),
            ...Array.from({ length: 25 }, (_, i) => ({ is_constructing: false, name: 'Öl-Raffinerie', location_x: i, location_y: 3 })),
            { is_constructing: true, name: 'Kaserne Level 1', location_x: 0, location_y: 4 },
        ];
        resourcesRepo.findByUserId.mockResolvedValue({
            geld: 500_000, stein: 10_000, stahl: 10_000, treibstoff: 3_000,
        });
        buildingRepo.findDetailedByUser.mockResolvedValue(productionReadyBuildings);
        buildingRepo.findPowerSummaryByUser.mockResolvedValue({ production: 100, consumption: 20 });

        unitsRepo.findTypeByName.mockResolvedValue({ id: 3, name: 'Soldat' });
        unitsService.startTraining.mockResolvedValue({ success: true });
        unitsRepo.findDetailedByUser.mockResolvedValue([
            { id: 901, category: 'infantry', is_moving: false, quantity: 12 },
        ]);
        playerRepo.findActiveHumanTargetsForMap.mockResolvedValue([
            { id: 30, koordinate_x: 10, koordinate_y: 0 },
        ]);
        combatService.launchAttack.mockResolvedValue({ success: true });

        // Erster Tick: Angriff findet statt und setzt Cooldown
        await tickAllNpcs();
        expect(combatService.launchAttack).toHaveBeenCalledTimes(1);

        vi.clearAllMocks();
        // Mocks nach clearAllMocks wiederherstellen für zweiten Tick
        npcRepo.findActiveNpcs.mockResolvedValue([
            { id: 21, npc_type: 'aggressive', koordinate_x: 0, koordinate_y: 0 },
        ]);
        resourcesRepo.findByUserId.mockResolvedValue({
            geld: 500_000, stein: 10_000, stahl: 10_000, treibstoff: 3_000,
        });
        buildingRepo.findDetailedByUser.mockResolvedValue(productionReadyBuildings);
        buildingRepo.findPowerSummaryByUser.mockResolvedValue({ production: 100, consumption: 20 });
        unitsRepo.findTypeByName.mockResolvedValue({ id: 3, name: 'Soldat' });
        unitsService.startTraining.mockResolvedValue({ success: true });
        unitsRepo.findDetailedByUser.mockResolvedValue([
            { id: 901, category: 'infantry', is_moving: false, quantity: 12 },
        ]);
        playerRepo.findActiveHumanTargetsForMap.mockResolvedValue([
            { id: 30, koordinate_x: 10, koordinate_y: 0 },
        ]);
        combatService.launchAttack.mockResolvedValue({ success: true });

        // Zweiter Tick direkt danach: Cooldown aktiv, kein Angriff
        await tickAllNpcs();
        expect(combatService.launchAttack).not.toHaveBeenCalled();
    });

    it('does not attack when minimum production goals are not yet reached', async () => {
        npcRepo.findActiveNpcs.mockResolvedValue([
            { id: 51, npc_type: 'aggressive', koordinate_x: 0, koordinate_y: 0 },
        ]);

        // Ressourcen unter 50 % der Ziele (treibstoff fehlt)
        resourcesRepo.findByUserId.mockResolvedValue({
            geld: 200_000, stein: 2_000, stahl: 1_000, treibstoff: 0,
        });
        buildingRepo.findDetailedByUser.mockResolvedValue([
            { is_constructing: false, name: 'Steinbruch', location_x: 0, location_y: 0 },
            { is_constructing: false, name: 'Stahlwerk',  location_x: 1, location_y: 0 },
            // Ölpumpe und Öl-Raffinerie fehlen noch
        ]);
        buildingRepo.findPowerSummaryByUser.mockResolvedValue({ production: 100, consumption: 20 });

        unitsRepo.findTypeByName.mockResolvedValue({ id: 3, name: 'Soldat' });
        unitsService.startTraining.mockResolvedValue({ success: true });
        unitsRepo.findDetailedByUser.mockResolvedValue([
            { id: 901, category: 'infantry', is_moving: false, quantity: 20 },
        ]);
        playerRepo.findActiveHumanTargetsForMap.mockResolvedValue([
            { id: 30, koordinate_x: 10, koordinate_y: 0 },
        ]);
        buildingRepo.findTypeByName.mockResolvedValue({ id: 5, name: 'Ölpumpe' });
        buildingService.startBuildingConstruction.mockResolvedValue({ success: true });

        await tickAllNpcs();

        expect(combatService.launchAttack).not.toHaveBeenCalled();
    });

    it('logs and continues when a single NPC tick fails', async () => {
        npcRepo.findActiveNpcs.mockResolvedValue([
            { id: 41, npc_type: 'defensive', koordinate_x: 0, koordinate_y: 0 },
            { id: 42, npc_type: 'defensive', koordinate_x: 0, koordinate_y: 0 },
        ]);

        resourcesRepo.findByUserId
            .mockRejectedValueOnce(new Error('boom'))
            .mockResolvedValueOnce({ geld: 100_000, stein: 2_000, stahl: 1_000 });
        buildingRepo.findDetailedByUser.mockResolvedValue([]);
        buildingRepo.findPowerSummaryByUser.mockResolvedValue({ production: 0, consumption: 10 });
        buildingRepo.findTypeByName.mockResolvedValue({ id: 1, name: 'Kraftwerk' });
        buildingService.startBuildingConstruction.mockResolvedValue({ success: true });

        await tickAllNpcs();

        expect(logger.error).toHaveBeenCalledWith(
            expect.objectContaining({ npcId: 41, err: expect.any(Error) }),
            '[NPC] Tick fehlgeschlagen'
        );
        expect(buildingService.startBuildingConstruction).toHaveBeenCalledTimes(1);
    });
});
