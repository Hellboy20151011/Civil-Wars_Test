import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../repositories/spy-missions.repository.js');
vi.mock('../../repositories/player.repository.js');
vi.mock('../../repositories/units.repository.js');
vi.mock('../../repositories/transaction.repository.js');
vi.mock('../../services/live-updates.service.js');
vi.mock('../../utils/game-math.js');

import * as spyRepo from '../../repositories/spy-missions.repository.js';
import * as playerRepo from '../../repositories/player.repository.js';
import * as unitsRepo from '../../repositories/units.repository.js';
import { withTransaction } from '../../repositories/transaction.repository.js';
import { calcDistance, calcArrivalTime } from '../../utils/game-math.js';
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
        unitsRepo.findUserUnitById.mockResolvedValue(null);

        await expect(launchSpyMission(1, 2, [{ user_unit_id: 99, quantity: 1 }])).rejects.toMatchObject({
            code: 'UNIT_NOT_FOUND',
        });
    });

    it('wirft INVALID_UNIT_CATEGORY wenn Einheit keine intel-Kategorie hat', async () => {
        playerRepo.findById
            .mockResolvedValueOnce({ id: 1, koordinate_x: 0, koordinate_y: 0, username: 'spy' })
            .mockResolvedValueOnce({ id: 2, koordinate_x: 5, koordinate_y: 5, username: 'target' });
        unitsRepo.findUserUnitById.mockResolvedValue({
            id: 1, user_id: 1, category: 'infantry', name: 'Infanterist',
            is_moving: false, quantity: 5, movement_speed: 2,
        });

        await expect(launchSpyMission(1, 2, [{ user_unit_id: 1, quantity: 1 }])).rejects.toMatchObject({
            code: 'INVALID_UNIT_CATEGORY',
        });
    });

    it('wirft UNIT_BUSY wenn Einheit bereits im Einsatz ist', async () => {
        playerRepo.findById
            .mockResolvedValueOnce({ id: 1, koordinate_x: 0, koordinate_y: 0, username: 'spy' })
            .mockResolvedValueOnce({ id: 2, koordinate_x: 5, koordinate_y: 5, username: 'target' });
        unitsRepo.findUserUnitById.mockResolvedValue({
            id: 1, user_id: 1, category: 'intel', name: 'Agent',
            is_moving: true, quantity: 5, movement_speed: 2,
        });

        await expect(launchSpyMission(1, 2, [{ user_unit_id: 1, quantity: 1 }])).rejects.toMatchObject({
            code: 'UNIT_BUSY',
        });
    });

    it('wirft INSUFFICIENT_UNITS wenn nicht genug Einheiten vorhanden', async () => {
        playerRepo.findById
            .mockResolvedValueOnce({ id: 1, koordinate_x: 0, koordinate_y: 0, username: 'spy' })
            .mockResolvedValueOnce({ id: 2, koordinate_x: 5, koordinate_y: 5, username: 'target' });
        unitsRepo.findUserUnitById.mockResolvedValue({
            id: 1, user_id: 1, category: 'intel', name: 'Agent',
            is_moving: false, quantity: 1, movement_speed: 2,
        });

        await expect(launchSpyMission(1, 2, [{ user_unit_id: 1, quantity: 5 }])).rejects.toMatchObject({
            code: 'INSUFFICIENT_UNITS',
        });
    });

    it('wirft SAME_POSITION wenn Distanz 0 ist', async () => {
        playerRepo.findById
            .mockResolvedValueOnce({ id: 1, koordinate_x: 5, koordinate_y: 5, username: 'spy' })
            .mockResolvedValueOnce({ id: 2, koordinate_x: 5, koordinate_y: 5, username: 'target' });
        unitsRepo.findUserUnitById.mockResolvedValue({
            id: 1, user_id: 1, category: 'intel', name: 'Agent',
            is_moving: false, quantity: 5, movement_speed: 2,
        });
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
        unitsRepo.findUserUnitById.mockResolvedValue({
            id: 1, user_id: 1, category: 'intel', name: 'Agent',
            is_moving: false, quantity: 5, movement_speed: 2,
        });
        calcDistance.mockReturnValue(8);
        calcArrivalTime.mockReturnValue(arrivalTime);
        spyRepo.createMission.mockResolvedValue({ id: 7 });
        unitsRepo.decrementUserUnitQuantity.mockResolvedValue(undefined);
        spyRepo.addMissionUnit.mockResolvedValue(undefined);

        const result = await launchSpyMission(1, 2, [{ user_unit_id: 1, quantity: 2 }]);

        expect(spyRepo.createMission).toHaveBeenCalled();
        expect(result.missionId).toBe(7);
        expect(result.spiesSent).toBe(2);
        expect(result.targetUsername).toBe('target');
        expect(result.arrivalTime).toEqual(arrivalTime);
    });
});

// ---------------------------------------------------------------------------
// processArrivingSpyMissions
// ---------------------------------------------------------------------------
describe('processArrivingSpyMissions', () => {
    it('verarbeitet ankommende Missionen ohne Fehler', async () => {
        // Math.random = 0.5, intelLevel=2 → rate=0.70, all spies succeed → full report
        vi.spyOn(Math, 'random').mockReturnValue(0.5);
        const mission = {
            id: 1, spy_id: 1, target_id: 2,
            spy_username: 'spy', target_username: 'target',
            spies_sent: 1, distance: 8,
        };
        spyRepo.findArrivingMissions.mockResolvedValue([mission]);
        spyRepo.findMissionUnits.mockResolvedValue([
            { id: 10, user_unit_id: 1, quantity_sent: 1, name: 'Agent', movement_speed: 2 },
        ]);
        spyRepo.findIntelLevel.mockResolvedValue(2);
        spyRepo.findCounterIntelLevel.mockResolvedValue(0);
        spyRepo.findBuildingSummaryForReport.mockResolvedValue({ military: 2 });
        // Include infantry and defense units to cover lines 91-92 (non-intel filter) and 97-98 (defense filter)
        spyRepo.findUnitSummaryForReport.mockResolvedValue([
            { name: 'Infanterist', category: 'infantry', quantity: 5 },
            { name: 'Küstengeschütz', category: 'defense', quantity: 2 },
        ]);
        spyRepo.setMissionResult.mockResolvedValue(undefined);

        await expect(processArrivingSpyMissions()).resolves.toBeUndefined();
        const call = spyRepo.setMissionResult.mock.calls[0];
        expect(call[2].detail).toBe('full');
        expect(call[2].units).toHaveProperty('Infanterist');
        expect(call[2].defenses).toHaveLength(1);
        vi.spyOn(Math, 'random').mockRestore();
    });

    it('filtert intel-Einheiten aus full-detail units heraus', async () => {
        vi.spyOn(Math, 'random').mockReturnValue(0.5);
        const mission = {
            id: 8, spy_id: 1, target_id: 2,
            spy_username: 'spy', target_username: 'target',
            spies_sent: 1, distance: 8,
        };
        spyRepo.findArrivingMissions.mockResolvedValue([mission]);
        spyRepo.findMissionUnits.mockResolvedValue([
            { id: 10, user_unit_id: 1, quantity_sent: 1, name: 'Agent', movement_speed: 2 },
        ]);
        spyRepo.findIntelLevel.mockResolvedValue(2);
        spyRepo.findCounterIntelLevel.mockResolvedValue(0);
        spyRepo.findBuildingSummaryForReport.mockResolvedValue({ military: 2 });
        spyRepo.findUnitSummaryForReport.mockResolvedValue([
            { name: 'Infanterist', category: 'infantry', quantity: 5 },
            { name: 'Agent', category: 'intel', quantity: 1 },
        ]);
        spyRepo.setMissionResult.mockResolvedValue(undefined);

        await expect(processArrivingSpyMissions()).resolves.toBeUndefined();
        const call = spyRepo.setMissionResult.mock.calls[0];
        expect(call[2].detail).toBe('full');
        expect(call[2].units).toHaveProperty('Infanterist');
        expect(call[2].units).not.toHaveProperty('Agent');
        vi.spyOn(Math, 'random').mockRestore();
    });

    it('setzt Status auf aborted wenn alle Spione erwischt wurden', async () => {
        // Math.random immer 1 → alle Spione scheitern
        vi.spyOn(Math, 'random').mockReturnValue(1);

        const mission = {
            id: 2, spy_id: 1, target_id: 2,
            spy_username: 'spy', target_username: 'target',
            spies_sent: 1, distance: 5,
        };
        spyRepo.findArrivingMissions.mockResolvedValue([mission]);
        spyRepo.findMissionUnits.mockResolvedValue([
            { id: 10, user_unit_id: 1, quantity_sent: 1, name: 'Agent', movement_speed: 2 },
        ]);
        spyRepo.findIntelLevel.mockResolvedValue(0);
        spyRepo.findCounterIntelLevel.mockResolvedValue(3); // starke Gegenspionage
        spyRepo.setMissionResult.mockResolvedValue(undefined);

        await processArrivingSpyMissions();

        const call = spyRepo.setMissionResult.mock.calls[0];
        expect(call[1]).toBe('aborted');
        expect(call[2].success).toBe(false);

        vi.spyOn(Math, 'random').mockRestore();
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
    it('gibt überlebende Spione zurück und schließt Mission ab', async () => {
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

        // 3 gesendet - 1 erwischt = 2 zurück
        expect(unitsRepo.addUnitQuantity).toHaveBeenCalledWith(1, 2, {});
        expect(spyRepo.completeMission).toHaveBeenCalledWith(1, 2, {});
    });

    it('loggt Fehler bei einzelner Mission ohne andere zu blockieren', async () => {
        spyRepo.findReturningMissions.mockResolvedValue([
            { id: 5, spy_id: 1, target_username: 'target', spies_sent: 1, report: {} },
        ]);
        // Reject inside transaction → catch block (line 333) should be hit
        spyRepo.findMissionUnits.mockRejectedValue(new Error('DB error'));

        await expect(processReturningSpyMissions()).resolves.toBeUndefined();
    });

    it('stoppt Rueckgabe sobald remainingToReturn 0 erreicht', async () => {
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

        expect(unitsRepo.addUnitQuantity).toHaveBeenCalledTimes(1);
        expect(unitsRepo.addUnitQuantity).toHaveBeenCalledWith(1, 1, {});
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
            id: 1, movement_speed: 2, fuel_cost: 5,
        });
        calcDistance.mockReturnValue(10);
        spyRepo.findIntelLevel.mockResolvedValue(1);
        spyRepo.findCounterIntelLevel.mockResolvedValue(0);

        const result = await getMissionPreview(1, 2, [1]);

        expect(result.distance).toBe(10);
        expect(result.targetUsername).toBe('target');
        expect(result.fuelCost).toBeGreaterThanOrEqual(0);
        expect(result.estimatedSuccessRate).toBeGreaterThan(0);
    });

    it('wirft UNIT_NOT_FOUND wenn keine gültigen Einheiten', async () => {
        playerRepo.findById
            .mockResolvedValueOnce({ id: 1, koordinate_x: 0, koordinate_y: 0, username: 'spy' })
            .mockResolvedValueOnce({ id: 2, koordinate_x: 5, koordinate_y: 5, username: 'target' });
        unitsRepo.findUserUnitById.mockResolvedValue(null);

        await expect(getMissionPreview(1, 2, [99])).rejects.toMatchObject({
            code: 'UNIT_NOT_FOUND',
        });
    });
});

// ---------------------------------------------------------------------------
// calcSuccessRate – Sonderboni für fortgeschrittene Einheiten
// ---------------------------------------------------------------------------
describe('calcSuccessRate via processArrivingSpyMissions', () => {
    const mkMission = (id) => ({
        id,
        spy_id: 1,
        target_id: 2,
        spy_username: 'spy',
        target_username: 'target',
        spies_sent: 1,
        distance: 5,
    });

    it('SR-71 Aufklärer erhält +15 % Erfolgsbonus', async () => {
        // intelLevel=0, counterIntelLevel=0 → base=50 → with SR-71: 65 → successRate=0.65
        vi.spyOn(Math, 'random').mockReturnValue(0.5); // 0.5 < 0.65 → Erfolg
        spyRepo.findArrivingMissions.mockResolvedValue([mkMission(20)]);
        spyRepo.findMissionUnits.mockResolvedValue([
            { id: 10, user_unit_id: 1, quantity_sent: 1, name: 'SR-71 Aufklärer', movement_speed: 3 },
        ]);
        spyRepo.findIntelLevel.mockResolvedValue(0);
        spyRepo.findCounterIntelLevel.mockResolvedValue(0);
        spyRepo.findBuildingSummaryForReport.mockResolvedValue({ military: 1 });
        spyRepo.findUnitSummaryForReport.mockResolvedValue([]);
        spyRepo.setMissionResult.mockResolvedValue(undefined);

        await processArrivingSpyMissions();

        const call = spyRepo.setMissionResult.mock.calls[0];
        expect(call[1]).toBe('traveling_back'); // mission succeeded
        vi.spyOn(Math, 'random').mockRestore();
    });

    it('Spionagesatellit erhält +30 % Erfolgsbonus', async () => {
        // intelLevel=0, counterIntelLevel=0 → base=50 → with Satellit: 80 → successRate=0.80
        vi.spyOn(Math, 'random').mockReturnValue(0.7); // 0.7 < 0.80 → Erfolg
        spyRepo.findArrivingMissions.mockResolvedValue([mkMission(21)]);
        spyRepo.findMissionUnits.mockResolvedValue([
            { id: 11, user_unit_id: 1, quantity_sent: 1, name: 'Spionagesatellit', movement_speed: 4 },
        ]);
        spyRepo.findIntelLevel.mockResolvedValue(0);
        spyRepo.findCounterIntelLevel.mockResolvedValue(0);
        spyRepo.findBuildingSummaryForReport.mockResolvedValue({ military: 1 });
        spyRepo.findUnitSummaryForReport.mockResolvedValue([]);
        spyRepo.setMissionResult.mockResolvedValue(undefined);

        await processArrivingSpyMissions();

        const call = spyRepo.setMissionResult.mock.calls[0];
        expect(call[1]).toBe('traveling_back');
        vi.spyOn(Math, 'random').mockRestore();
    });
});

// ---------------------------------------------------------------------------
// buildReport – detail-Level (low / medium / full)
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

    it('erstellt einen Low-Detail-Bericht wenn successRate < 0.30', async () => {
        // intelLevel=0, counterIntelLevel=2 → base = 50 - 30 = 20 → 0.20 < 0.30
        vi.spyOn(Math, 'random').mockReturnValue(0.1); // 0.1 < 0.20 → Erfolg
        spyRepo.findArrivingMissions.mockResolvedValue([mkMission(30)]);
        spyRepo.findMissionUnits.mockResolvedValue([
            { id: 12, user_unit_id: 1, quantity_sent: 1, name: 'Agent', movement_speed: 2 },
        ]);
        spyRepo.findIntelLevel.mockResolvedValue(0);
        spyRepo.findCounterIntelLevel.mockResolvedValue(2);
        spyRepo.findBuildingSummaryForReport.mockResolvedValue({ military: 2, economy: 1 });
        spyRepo.findUnitSummaryForReport.mockResolvedValue([]);
        spyRepo.setMissionResult.mockResolvedValue(undefined);

        await processArrivingSpyMissions();

        const call = spyRepo.setMissionResult.mock.calls[0];
        const report = call[2];
        expect(report.detail).toBe('low');
        expect(report.buildings).toHaveProperty('categories');
        vi.spyOn(Math, 'random').mockRestore();
    });

    it('erstellt einen Medium-Detail-Bericht wenn 0.30 <= successRate < 0.60', async () => {
        // intelLevel=0, counterIntelLevel=1 → base = 50 - 15 = 35 → 0.35
        vi.spyOn(Math, 'random').mockReturnValue(0.2); // 0.2 < 0.35 → Erfolg
        spyRepo.findArrivingMissions.mockResolvedValue([mkMission(31)]);
        spyRepo.findMissionUnits.mockResolvedValue([
            { id: 13, user_unit_id: 1, quantity_sent: 1, name: 'Agent', movement_speed: 2 },
        ]);
        spyRepo.findIntelLevel.mockResolvedValue(0);
        spyRepo.findCounterIntelLevel.mockResolvedValue(1);
        spyRepo.findBuildingSummaryForReport.mockResolvedValue({ military: 3 });
        spyRepo.findUnitSummaryForReport.mockResolvedValue([
            { name: 'Infanterist', category: 'infantry', quantity: 5 },
        ]);
        spyRepo.setMissionResult.mockResolvedValue(undefined);

        await processArrivingSpyMissions();

        const call = spyRepo.setMissionResult.mock.calls[0];
        const report = call[2];
        expect(report.detail).toBe('medium');
        expect(report.units).toHaveProperty('categories');
        vi.spyOn(Math, 'random').mockRestore();
    });
});
