import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../repositories/spy-missions.repository.js');
vi.mock('../../repositories/player.repository.js');
vi.mock('../../repositories/units.repository.js');
vi.mock('../../repositories/resources.repository.js');
vi.mock('../../repositories/transaction.repository.js');
vi.mock('../../services/live-updates.service.js');
vi.mock('../../utils/game-math.js', async (importOriginal) => {
    const real = await importOriginal();
    return {
        ...real,
        calcDistance: vi.fn(),
        calcArrivalTime: vi.fn(),
    };
});

import * as spyRepo from '../../repositories/spy-missions.repository.js';
import * as playerRepo from '../../repositories/player.repository.js';
import * as unitsRepo from '../../repositories/units.repository.js';
import * as resourcesRepo from '../../repositories/resources.repository.js';
import { withTransaction } from '../../repositories/transaction.repository.js';
import { calcDistance, calcArrivalTime } from '../../utils/game-math.js';
import { broadcastToUser } from '../../services/live-updates.service.js';
import {
    launchSpyMission,
    processArrivingSpyMissions,
    processReturningSpyMissions,
    getActiveMissions,
    getReports,
    getMissionPreview,
} from '../../services/espionage.service.js';

withTransaction.mockImplementation(async (fn) => fn({}));
calcDistance.mockReturnValue(8);
calcArrivalTime.mockReturnValue(new Date('2026-01-01T00:08:00Z'));

beforeEach(() => {
    vi.clearAllMocks();
    withTransaction.mockImplementation(async (fn) => fn({}));
    calcDistance.mockReturnValue(8);
    calcArrivalTime.mockReturnValue(new Date('2026-01-01T00:08:00Z'));
    resourcesRepo.findByUserIdLocked.mockResolvedValue({ treibstoff: 1000 });
    resourcesRepo.deductResources.mockResolvedValue(undefined);
});

// ---------------------------------------------------------------------------
// launchSpyMission – Validierungen
// ---------------------------------------------------------------------------
describe('launchSpyMission', () => {
    it('wirft NO_UNITS wenn units-Array leer ist', async () => {
        await expect(launchSpyMission(1, 2, [])).rejects.toMatchObject({ code: 'NO_UNITS' });
    });

    it('wirft SELF_SPY wenn Angreifer und Ziel identisch sind', async () => {
        await expect(launchSpyMission(1, 1, [{ user_unit_id: 1, quantity: 1 }])).rejects.toMatchObject({
            code: 'SELF_SPY',
        });
    });

    it('wirft ATTACKER_NOT_FOUND wenn eigener Spieler nicht existiert', async () => {
        playerRepo.findById.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 2, koordinate_x: 5, koordinate_y: 5, username: 'target' });
        await expect(launchSpyMission(1, 2, [{ user_unit_id: 1, quantity: 1 }])).rejects.toMatchObject({
            code: 'ATTACKER_NOT_FOUND',
        });
    });

    it('wirft DEFENDER_NOT_FOUND wenn Ziel nicht existiert', async () => {
        playerRepo.findById
            .mockResolvedValueOnce({ id: 1, koordinate_x: 0, koordinate_y: 0, username: 'spy' })
            .mockResolvedValueOnce(null);
        await expect(launchSpyMission(1, 2, [{ user_unit_id: 1, quantity: 1 }])).rejects.toMatchObject({
            code: 'DEFENDER_NOT_FOUND',
        });
    });

    it('wirft MISSING_COORDINATES wenn Koordinaten fehlen', async () => {
        playerRepo.findById
            .mockResolvedValueOnce({ id: 1, koordinate_x: null, koordinate_y: null, username: 'spy' })
            .mockResolvedValueOnce({ id: 2, koordinate_x: 5, koordinate_y: 5, username: 'target' });
        await expect(launchSpyMission(1, 2, [{ user_unit_id: 1, quantity: 1 }])).rejects.toMatchObject({
            code: 'MISSING_COORDINATES',
        });
    });

    it('wirft UNIT_NOT_FOUND wenn Einheit nicht existiert', async () => {
        playerRepo.findById
            .mockResolvedValueOnce({ id: 1, koordinate_x: 0, koordinate_y: 0, username: 'spy' })
            .mockResolvedValueOnce({ id: 2, koordinate_x: 5, koordinate_y: 5, username: 'target' });
        unitsRepo.findMovableUnitsByIds.mockResolvedValue([]);

        await expect(launchSpyMission(1, 2, [{ user_unit_id: 99, quantity: 1 }])).rejects.toMatchObject({
            code: 'UNIT_NOT_FOUND',
        });
    });

    it('wirft INVALID_UNIT_CATEGORY wenn Einheit keine intel-Kategorie hat', async () => {
        playerRepo.findById
            .mockResolvedValueOnce({ id: 1, koordinate_x: 0, koordinate_y: 0, username: 'spy' })
            .mockResolvedValueOnce({ id: 2, koordinate_x: 5, koordinate_y: 5, username: 'target' });
        unitsRepo.findMovableUnitsByIds.mockResolvedValue([
            {
                id: 1, user_id: 1, category: 'infantry', name: 'Infanterist',
                is_moving: false, quantity: 5, movement_speed: 2,
            },
        ]);

        await expect(launchSpyMission(1, 2, [{ user_unit_id: 1, quantity: 1 }])).rejects.toMatchObject({
            code: 'INVALID_UNIT_CATEGORY',
        });
    });

    it('wirft UNIT_BUSY wenn Einheit bereits im Einsatz ist', async () => {
        playerRepo.findById
            .mockResolvedValueOnce({ id: 1, koordinate_x: 0, koordinate_y: 0, username: 'spy' })
            .mockResolvedValueOnce({ id: 2, koordinate_x: 5, koordinate_y: 5, username: 'target' });
        unitsRepo.findMovableUnitsByIds.mockResolvedValue([
            {
                id: 1, user_id: 1, category: 'intel', name: 'Agent',
                is_moving: true, quantity: 5, movement_speed: 2,
            },
        ]);

        await expect(launchSpyMission(1, 2, [{ user_unit_id: 1, quantity: 1 }])).rejects.toMatchObject({
            code: 'UNIT_BUSY',
        });
    });

    it('wirft INSUFFICIENT_UNITS wenn nicht genug Einheiten vorhanden', async () => {
        playerRepo.findById
            .mockResolvedValueOnce({ id: 1, koordinate_x: 0, koordinate_y: 0, username: 'spy' })
            .mockResolvedValueOnce({ id: 2, koordinate_x: 5, koordinate_y: 5, username: 'target' });
        unitsRepo.findMovableUnitsByIds.mockResolvedValue([
            {
                id: 1, user_id: 1, category: 'intel', name: 'Agent',
                is_moving: false, quantity: 1, movement_speed: 2,
            },
        ]);

        await expect(launchSpyMission(1, 2, [{ user_unit_id: 1, quantity: 5 }])).rejects.toMatchObject({
            code: 'INSUFFICIENT_UNITS',
        });
    });

    it('wirft SAME_POSITION wenn Distanz 0 ist', async () => {
        playerRepo.findById
            .mockResolvedValueOnce({ id: 1, koordinate_x: 5, koordinate_y: 5, username: 'spy' })
            .mockResolvedValueOnce({ id: 2, koordinate_x: 5, koordinate_y: 5, username: 'target' });
        unitsRepo.findMovableUnitsByIds.mockResolvedValue([
            {
                id: 1, user_id: 1, category: 'intel', name: 'Agent',
                is_moving: false, quantity: 5, movement_speed: 2, fuel_cost: 5,
            },
        ]);
        calcDistance.mockReturnValue(0);

        await expect(launchSpyMission(1, 2, [{ user_unit_id: 1, quantity: 1 }])).rejects.toMatchObject({
            code: 'SAME_POSITION',
        });
    });

    it('legt Mission an und gibt korrekte Felder zurück', async () => {
        const arrivalTime = new Date('2026-01-01T00:08:00Z');
        playerRepo.findById
            .mockResolvedValueOnce({ id: 1, koordinate_x: 0, koordinate_y: 0, username: 'spy' })
            .mockResolvedValueOnce({ id: 2, koordinate_x: 5, koordinate_y: 5, username: 'target' });
        unitsRepo.findMovableUnitsByIds.mockResolvedValue([
            {
                id: 1, user_id: 1, category: 'intel', name: 'Agent',
                is_moving: false, quantity: 5, movement_speed: 2, fuel_cost: 5,
            },
        ]);
        calcDistance.mockReturnValue(8);
        calcArrivalTime.mockReturnValue(arrivalTime);
        spyRepo.createMission.mockResolvedValue({ id: 7 });
        unitsRepo.decrementUserUnitQuantity.mockResolvedValue(undefined);
        spyRepo.addMissionUnit.mockResolvedValue(undefined);

        const result = await launchSpyMission(1, 2, [{ user_unit_id: 1, quantity: 2 }]);

        expect(spyRepo.createMission).toHaveBeenCalled();
        expect(resourcesRepo.deductResources).toHaveBeenCalledWith(1, 0, 0, 0, 8, {});
        expect(result.missionId).toBe(7);
        expect(result.spiesSent).toBe(2);
        expect(result.targetUsername).toBe('target');
        expect(result.arrivalTime).toEqual(arrivalTime);
    });

    it('wirft INSUFFICIENT_RESOURCES wenn Treibstoff nicht ausreicht', async () => {
        playerRepo.findById
            .mockResolvedValueOnce({ id: 1, koordinate_x: 0, koordinate_y: 0, username: 'spy' })
            .mockResolvedValueOnce({ id: 2, koordinate_x: 5, koordinate_y: 5, username: 'target' });
        unitsRepo.findMovableUnitsByIds.mockResolvedValue([
            {
                id: 1,
                user_id: 1,
                category: 'intel',
                name: 'Agent',
                is_moving: false,
                quantity: 5,
                movement_speed: 2,
                fuel_cost: 5,
            },
        ]);
        calcDistance.mockReturnValue(10);
        resourcesRepo.findByUserIdLocked.mockResolvedValue({ treibstoff: 1 });

        await expect(launchSpyMission(1, 2, [{ user_unit_id: 1, quantity: 2 }])).rejects.toMatchObject({
            code: 'INSUFFICIENT_RESOURCES',
        });
    });
});

// ---------------------------------------------------------------------------
// processArrivingSpyMissions
// ---------------------------------------------------------------------------
describe('processArrivingSpyMissions', () => {
    it('erstellt einen level3-Bericht ohne Verteidigung und benachrichtigt den Verteidiger nicht', async () => {
        const mission = {
            id: 99, spy_id: 1, target_id: 2,
            spy_username: 'spy', target_username: 'target',
            spies_sent: 3, distance: 8,
        };
        spyRepo.findArrivingMissions.mockResolvedValue([mission]);
        spyRepo.findMissionUnits.mockResolvedValue([
            { id: 10, user_unit_id: 1, quantity_sent: 3, name: 'Agent', movement_speed: 2, spy_attack: 20 },
        ]);
        spyRepo.findTotalSpyDefense.mockResolvedValue(0);
        spyRepo.findUnitSummaryForReport.mockResolvedValue([
            { name: 'Infanterist', category: 'infantry', quantity: 5 },
            { name: 'Agent', category: 'intel', quantity: 1 },
            { name: 'Küstengeschütz', category: 'defense', quantity: 2 },
        ]);
        spyRepo.findProductionBuildingsForReport.mockResolvedValue([{ name: 'Stahlwerk', count: 2 }]);
        spyRepo.setMissionResult.mockResolvedValue(undefined);

        await processArrivingSpyMissions();

        const call = spyRepo.setMissionResult.mock.calls[0];
        expect(call[1]).toBe('traveling_back');
        expect(call[2].success).toBe(true);
        expect(call[2].detail).toBe('level3');
        expect(call[2].units).toHaveProperty('Infanterist');
        expect(call[2].units).not.toHaveProperty('Agent');
        expect(call[2].defenses).toEqual([{ name: 'Küstengeschütz', quantity: 2 }]);
        expect(broadcastToUser).toHaveBeenCalledTimes(1);
        expect(broadcastToUser).toHaveBeenCalledWith(1, 'spy_mission_update', expect.objectContaining({
            missionId: 99,
            status: 'traveling_back',
            level: 'level3',
            targetUsername: 'target',
        }));
    });

    it('erstellt einen level2-Bericht im mittleren Verhaeltnisbereich', async () => {
        const mission = {
            id: 1, spy_id: 1, target_id: 2,
            spy_username: 'spy', target_username: 'target',
            spies_sent: 1, distance: 8,
        };
        spyRepo.findArrivingMissions.mockResolvedValue([mission]);
        spyRepo.findMissionUnits.mockResolvedValue([
            { id: 10, user_unit_id: 1, quantity_sent: 1, name: 'Agent', movement_speed: 2, spy_attack: 13 },
        ]);
        spyRepo.findTotalSpyDefense.mockResolvedValue(10);
        spyRepo.findProductionBuildingsForReport.mockResolvedValue([{ name: 'Ölpumpe', count: 1 }]);
        spyRepo.findUnitDefenseTotalsForReport.mockResolvedValue({ totalUnits: 5, totalDefenses: 2 });
        spyRepo.setMissionResult.mockResolvedValue(undefined);

        await expect(processArrivingSpyMissions()).resolves.toBeUndefined();
        const call = spyRepo.setMissionResult.mock.calls[0];
        expect(call[1]).toBe('traveling_back');
        expect(call[2].detail).toBe('level2');
        expect(call[2].productionBuildings).toEqual([{ name: 'Ölpumpe', count: 1 }]);
        expect(call[2].totalUnits).toBe(5);
        expect(call[2].totalDefenses).toBe(2);
        expect(broadcastToUser).toHaveBeenNthCalledWith(1, 2, 'spy_detected', {
            spiesDetected: 0,
            originUsername: 'spy',
        });
        expect(broadcastToUser).toHaveBeenNthCalledWith(2, 1, 'spy_mission_update', expect.objectContaining({
            level: 'level2',
            status: 'traveling_back',
        }));
    });

    it('setzt Status auf aborted wenn das Angriffs-/Abwehr-Verhaeltnis zu niedrig ist', async () => {
        const mission = {
            id: 2, spy_id: 1, target_id: 2,
            spy_username: 'spy', target_username: 'target',
            spies_sent: 1, distance: 5,
        };
        spyRepo.findArrivingMissions.mockResolvedValue([mission]);
        spyRepo.findMissionUnits.mockResolvedValue([
            { id: 10, user_unit_id: 1, quantity_sent: 1, name: 'Agent', movement_speed: 2, spy_attack: 10 },
        ]);
        spyRepo.findTotalSpyDefense.mockResolvedValue(20);
        spyRepo.setMissionResult.mockResolvedValue(undefined);

        await processArrivingSpyMissions();

        const call = spyRepo.setMissionResult.mock.calls[0];
        expect(call[1]).toBe('aborted');
        expect(call[2].success).toBe(false);
        expect(call[2].detail).toBe('failed');
        expect(broadcastToUser).toHaveBeenNthCalledWith(1, 2, 'spy_detected', {
            spiesDetected: 1,
            originUsername: 'spy',
        });
        expect(broadcastToUser).toHaveBeenNthCalledWith(2, 1, 'spy_mission_update', expect.objectContaining({
            level: 'failed',
            status: 'aborted',
        }));
    });

    it('loggt Fehler bei einzelner Mission ohne andere zu blockieren', async () => {
        spyRepo.findArrivingMissions.mockResolvedValue([
            { id: 1, spy_id: 1, target_id: 2, spy_username: 'spy', target_username: 'target', spies_sent: 1, distance: 5 },
        ]);
        spyRepo.findMissionUnits.mockRejectedValue(new Error('DB error'));

        await expect(processArrivingSpyMissions()).resolves.toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// processReturningSpyMissions
// ---------------------------------------------------------------------------
describe('processReturningSpyMissions', () => {
    it('gibt bei erfolgreicher Rückkehr alle entsandten Spione zurück und schließt Mission ab', async () => {
        spyRepo.findReturningMissions.mockResolvedValue([
            {
                id: 1, spy_id: 1, target_username: 'target',
                spies_sent: 3, report: { spiesCaught: 1 },
            },
        ]);
        spyRepo.findMissionUnits.mockResolvedValue([
            { id: 10, user_unit_id: 1, quantity_sent: 3 },
        ]);
        unitsRepo.addUnitQuantity.mockResolvedValue(undefined);
        spyRepo.setUnitQuantityReturned.mockResolvedValue(undefined);
        spyRepo.completeMission.mockResolvedValue(undefined);

        await processReturningSpyMissions();

        expect(unitsRepo.addUnitQuantity).toHaveBeenCalledWith(1, 3, {});
        expect(spyRepo.completeMission).toHaveBeenCalledWith(1, 3, {});
    });

    it('loggt Fehler bei einzelner Mission ohne andere zu blockieren', async () => {
        spyRepo.findReturningMissions.mockResolvedValue([
            { id: 5, spy_id: 1, target_username: 'target', spies_sent: 1, report: {} },
        ]);
        // Reject inside transaction → catch block (line 333) should be hit
        spyRepo.findMissionUnits.mockRejectedValue(new Error('DB error'));

        await expect(processReturningSpyMissions()).resolves.toBeUndefined();
    });

    it('gibt alle Missions-Einheiten der Rueckreise wieder frei', async () => {
        spyRepo.findReturningMissions.mockResolvedValue([
            {
                id: 11, spy_id: 1, target_username: 'target',
                spies_sent: 2, report: { spiesCaught: 1 },
            },
        ]);
        spyRepo.findMissionUnits.mockResolvedValue([
            { id: 10, user_unit_id: 1, quantity_sent: 1 },
            { id: 11, user_unit_id: 2, quantity_sent: 1 },
        ]);
        unitsRepo.addUnitQuantity.mockResolvedValue(undefined);
        spyRepo.setUnitQuantityReturned.mockResolvedValue(undefined);
        spyRepo.completeMission.mockResolvedValue(undefined);

        await processReturningSpyMissions();

        expect(unitsRepo.addUnitQuantity).toHaveBeenCalledTimes(2);
        expect(unitsRepo.addUnitQuantity).toHaveBeenCalledWith(1, 1, {});
        expect(unitsRepo.addUnitQuantity).toHaveBeenCalledWith(2, 1, {});
    });
});

// ---------------------------------------------------------------------------
// Abfrage-Funktionen
// ---------------------------------------------------------------------------
describe('getActiveMissions', () => {
    it('delegiert an spyRepo.findActiveMissionsBySpy', async () => {
        spyRepo.findActiveMissionsBySpy.mockResolvedValue([]);
        await getActiveMissions(5);
        expect(spyRepo.findActiveMissionsBySpy).toHaveBeenCalledWith(5);
    });
});

describe('getReports', () => {
    it('delegiert an spyRepo.findReportsByUser', async () => {
        spyRepo.findReportsByUser.mockResolvedValue([]);
        await getReports(3);
        expect(spyRepo.findReportsByUser).toHaveBeenCalledWith(3);
    });
});

// ---------------------------------------------------------------------------
// getMissionPreview – Vorschau ohne Mission anlegen
// ---------------------------------------------------------------------------
describe('getMissionPreview', () => {
    it('wirft DEFENDER_NOT_FOUND wenn ein Spieler nicht gefunden wird', async () => {
        playerRepo.findById.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
        await expect(getMissionPreview(1, 2, [1])).rejects.toMatchObject({
            code: 'DEFENDER_NOT_FOUND',
        });
    });

    it('gibt Vorschau-Daten zurück', async () => {
        playerRepo.findById
            .mockResolvedValueOnce({ id: 1, koordinate_x: 0, koordinate_y: 0, username: 'spy' })
            .mockResolvedValueOnce({ id: 2, koordinate_x: 6, koordinate_y: 8, username: 'target' });
        unitsRepo.findUserUnitById.mockResolvedValue({
            id: 1, user_id: 1, category: 'intel', quantity: 99, movement_speed: 2, fuel_cost: 5,
        });
        calcDistance.mockReturnValue(10);

        const result = await getMissionPreview(1, 2, [{ user_unit_id: 1, quantity: 3 }]);

        expect(result.distance).toBe(10);
        expect(result.targetUsername).toBe('target');
        expect(result.fuelCost).toBe(15);
    });

    it('wirft UNIT_NOT_FOUND wenn keine gültigen Einheiten', async () => {
        playerRepo.findById
            .mockResolvedValueOnce({ id: 1, koordinate_x: 0, koordinate_y: 0, username: 'spy' })
            .mockResolvedValueOnce({ id: 2, koordinate_x: 5, koordinate_y: 5, username: 'target' });
        unitsRepo.findUserUnitById.mockResolvedValue(null);

        await expect(getMissionPreview(1, 2, [{ user_unit_id: 99, quantity: 1 }])).rejects.toMatchObject({
            code: 'UNIT_NOT_FOUND',
        });
    });
});

// ---------------------------------------------------------------------------
// Verhältnislogik – Levelableitung über Angriff/Abwehr
// ---------------------------------------------------------------------------
describe('determineSpyLevel via processArrivingSpyMissions', () => {
    const mkMission = (id) => ({
        id,
        spy_id: 1,
        target_id: 2,
        spy_username: 'spy',
        target_username: 'target',
        spies_sent: 1,
        distance: 5,
    });

    it('klassifiziert 1.10 Verhältnis als level1', async () => {
        spyRepo.findArrivingMissions.mockResolvedValue([mkMission(20)]);
        spyRepo.findMissionUnits.mockResolvedValue([
            { id: 10, user_unit_id: 1, quantity_sent: 1, name: 'Agent', movement_speed: 3, spy_attack: 11 },
        ]);
        spyRepo.findTotalSpyDefense.mockResolvedValue(10);
        spyRepo.findPlunderableBuildingCount.mockResolvedValue(4);
        spyRepo.setMissionResult.mockResolvedValue(undefined);

        await processArrivingSpyMissions();

        const call = spyRepo.setMissionResult.mock.calls[0];
        expect(call[1]).toBe('traveling_back');
        expect(call[2].detail).toBe('level1');
    });

    it('klassifiziert 1.80 Verhältnis als level3', async () => {
        spyRepo.findArrivingMissions.mockResolvedValue([mkMission(21)]);
        spyRepo.findMissionUnits.mockResolvedValue([
            { id: 11, user_unit_id: 1, quantity_sent: 1, name: 'Spionagesatellit', movement_speed: 4, spy_attack: 18 },
        ]);
        spyRepo.findTotalSpyDefense.mockResolvedValue(10);
        spyRepo.findUnitSummaryForReport.mockResolvedValue([]);
        spyRepo.findProductionBuildingsForReport.mockResolvedValue([]);
        spyRepo.setMissionResult.mockResolvedValue(undefined);

        await processArrivingSpyMissions();

        const call = spyRepo.setMissionResult.mock.calls[0];
        expect(call[1]).toBe('traveling_back');
        expect(call[2].detail).toBe('level3');
    });
});

// ---------------------------------------------------------------------------
// buildReport – detail-Level (level1 / level2)
// ---------------------------------------------------------------------------
describe('buildReport detail-Level via processArrivingSpyMissions', () => {
    const mkMission = (id) => ({
        id,
        spy_id: 1,
        target_id: 2,
        spy_username: 'spy',
        target_username: 'target',
        spies_sent: 1,
        distance: 5,
    });

    it('erstellt einen level1-Bericht bei leichter Überlegenheit', async () => {
        spyRepo.findArrivingMissions.mockResolvedValue([mkMission(30)]);
        spyRepo.findMissionUnits.mockResolvedValue([
            { id: 12, user_unit_id: 1, quantity_sent: 1, name: 'Agent', movement_speed: 2, spy_attack: 11 },
        ]);
        spyRepo.findTotalSpyDefense.mockResolvedValue(10);
        spyRepo.findPlunderableBuildingCount.mockResolvedValue(6);
        spyRepo.setMissionResult.mockResolvedValue(undefined);

        await processArrivingSpyMissions();

        const call = spyRepo.setMissionResult.mock.calls[0];
        const report = call[2];
        expect(report.detail).toBe('level1');
        expect(report.plunderableBuildingsApprox).toBeTypeOf('number');
        expect(report.defenseValueFuzzy).toBeTypeOf('number');
    });

    it('erstellt einen level2-Bericht bei mittlerer Überlegenheit', async () => {
        spyRepo.findArrivingMissions.mockResolvedValue([mkMission(31)]);
        spyRepo.findMissionUnits.mockResolvedValue([
            { id: 13, user_unit_id: 1, quantity_sent: 1, name: 'Agent', movement_speed: 2, spy_attack: 13 },
        ]);
        spyRepo.findTotalSpyDefense.mockResolvedValue(10);
        spyRepo.findProductionBuildingsForReport.mockResolvedValue([{ name: 'Kraftwerk', count: 2 }]);
        spyRepo.findUnitDefenseTotalsForReport.mockResolvedValue({ totalUnits: 5, totalDefenses: 3 });
        spyRepo.setMissionResult.mockResolvedValue(undefined);

        await processArrivingSpyMissions();

        const call = spyRepo.setMissionResult.mock.calls[0];
        const report = call[2];
        expect(report.detail).toBe('level2');
        expect(report.productionBuildings).toEqual([{ name: 'Kraftwerk', count: 2 }]);
        expect(report.totalUnits).toBe(5);
        expect(report.totalDefenses).toBe(3);
    });
});
