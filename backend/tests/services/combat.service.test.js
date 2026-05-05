import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../repositories/combat-missions.repository.js');
vi.mock('../../repositories/player.repository.js');
vi.mock('../../repositories/units.repository.js');
vi.mock('../../repositories/transaction.repository.js');
vi.mock('../../services/live-updates.service.js');
vi.mock('../../utils/game-math.js');

import * as combatMissionsRepo from '../../repositories/combat-missions.repository.js';
import * as playerRepo from '../../repositories/player.repository.js';
import * as unitsRepo from '../../repositories/units.repository.js';
import { withTransaction } from '../../repositories/transaction.repository.js';
import { calcDistance, calcArrivalTime } from '../../utils/game-math.js';
import {
    launchAttack,
    processArrivingMissions,
    processReturningMissions,
    getActiveMissions,
    getIncomingAttacks,
    getMissionHistory,
} from '../../services/combat.service.js';

// withTransaction führt den Callback direkt mit einem Fake-Client aus
withTransaction.mockImplementation(async (fn) => fn({}));

// game-math Stubs
calcDistance.mockReturnValue(10);
calcArrivalTime.mockReturnValue(new Date('2026-01-01T00:10:00Z'));

beforeEach(() => {
    vi.clearAllMocks();
    withTransaction.mockImplementation(async (fn) => fn({}));
    calcDistance.mockReturnValue(10);
    calcArrivalTime.mockReturnValue(new Date('2026-01-01T00:10:00Z'));
});

// ---------------------------------------------------------------------------
// launchAttack – Validierungen
// ---------------------------------------------------------------------------
describe('launchAttack', () => {
    it('wirft NO_UNITS wenn units-Array leer ist', async () => {
        await expect(launchAttack(1, 2, [])).rejects.toMatchObject({ code: 'NO_UNITS' });
    });

    it('wirft SELF_ATTACK wenn Angreifer und Verteidiger identisch sind', async () => {
        await expect(launchAttack(1, 1, [{ userUnitId: 1, quantity: 1 }])).rejects.toMatchObject({
            code: 'SELF_ATTACK',
        });
    });

    it('wirft ATTACKER_NOT_FOUND wenn Angreifer nicht existiert', async () => {
        playerRepo.findById.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 2, koordinate_x: 5, koordinate_y: 5, username: 'def' });
        await expect(launchAttack(1, 2, [{ userUnitId: 1, quantity: 1 }])).rejects.toMatchObject({
            code: 'ATTACKER_NOT_FOUND',
        });
    });

    it('wirft DEFENDER_NOT_FOUND wenn Verteidiger nicht existiert', async () => {
        playerRepo.findById
            .mockResolvedValueOnce({ id: 1, koordinate_x: 0, koordinate_y: 0, username: 'atk' })
            .mockResolvedValueOnce(null);
        await expect(launchAttack(1, 2, [{ userUnitId: 1, quantity: 1 }])).rejects.toMatchObject({
            code: 'DEFENDER_NOT_FOUND',
        });
    });

    it('wirft MISSING_COORDINATES wenn Koordinaten fehlen', async () => {
        playerRepo.findById
            .mockResolvedValueOnce({ id: 1, koordinate_x: null, koordinate_y: null, username: 'atk' })
            .mockResolvedValueOnce({ id: 2, koordinate_x: 5, koordinate_y: 5, username: 'def' });
        await expect(launchAttack(1, 2, [{ userUnitId: 1, quantity: 1 }])).rejects.toMatchObject({
            code: 'MISSING_COORDINATES',
        });
    });

    it('wirft UNIT_NOT_FOUND wenn Einheit nicht gefunden', async () => {
        playerRepo.findById
            .mockResolvedValueOnce({ id: 1, koordinate_x: 0, koordinate_y: 0, username: 'atk' })
            .mockResolvedValueOnce({ id: 2, koordinate_x: 5, koordinate_y: 5, username: 'def' });
        unitsRepo.findMovableUnit.mockResolvedValue(null);

        await expect(launchAttack(1, 2, [{ userUnitId: 99, quantity: 1 }])).rejects.toMatchObject({
            code: 'UNIT_NOT_FOUND',
        });
    });

    it('wirft UNIT_BUSY wenn Einheit bereits unterwegs ist', async () => {
        playerRepo.findById
            .mockResolvedValueOnce({ id: 1, koordinate_x: 0, koordinate_y: 0, username: 'atk' })
            .mockResolvedValueOnce({ id: 2, koordinate_x: 5, koordinate_y: 5, username: 'def' });
        unitsRepo.findMovableUnit.mockResolvedValue({ id: 1, is_moving: true, quantity: 5, movement_speed: 2 });

        await expect(launchAttack(1, 2, [{ userUnitId: 1, quantity: 1 }])).rejects.toMatchObject({
            code: 'UNIT_BUSY',
        });
    });

    it('wirft INSUFFICIENT_UNITS wenn nicht genug Einheiten vorhanden', async () => {
        playerRepo.findById
            .mockResolvedValueOnce({ id: 1, koordinate_x: 0, koordinate_y: 0, username: 'atk' })
            .mockResolvedValueOnce({ id: 2, koordinate_x: 5, koordinate_y: 5, username: 'def' });
        unitsRepo.findMovableUnit.mockResolvedValue({ id: 1, is_moving: false, quantity: 2, movement_speed: 2 });

        await expect(launchAttack(1, 2, [{ userUnitId: 1, quantity: 5 }])).rejects.toMatchObject({
            code: 'INSUFFICIENT_UNITS',
        });
    });

    it('wirft SAME_POSITION wenn Distanz 0 ist', async () => {
        playerRepo.findById
            .mockResolvedValueOnce({ id: 1, koordinate_x: 5, koordinate_y: 5, username: 'atk' })
            .mockResolvedValueOnce({ id: 2, koordinate_x: 5, koordinate_y: 5, username: 'def' });
        unitsRepo.findMovableUnit.mockResolvedValue({ id: 1, is_moving: false, quantity: 5, movement_speed: 2 });
        calcDistance.mockReturnValue(0);

        await expect(launchAttack(1, 2, [{ userUnitId: 1, quantity: 1 }])).rejects.toMatchObject({
            code: 'SAME_POSITION',
        });
    });

    it('legt Mission an und gibt missionId, distance und arrivalTime zurück', async () => {
        const arrivalTime = new Date('2026-01-01T00:10:00Z');
        playerRepo.findById
            .mockResolvedValueOnce({ id: 1, koordinate_x: 0, koordinate_y: 0, username: 'atk' })
            .mockResolvedValueOnce({ id: 2, koordinate_x: 5, koordinate_y: 5, username: 'def' });
        unitsRepo.findMovableUnit.mockResolvedValue({
            id: 1, is_moving: false, quantity: 10, movement_speed: 2,
        });
        calcDistance.mockReturnValue(10);
        calcArrivalTime.mockReturnValue(arrivalTime);
        combatMissionsRepo.createMission.mockResolvedValue({ id: 42 });
        combatMissionsRepo.addMissionUnit.mockResolvedValue(undefined);
        unitsRepo.decrementUserUnitQuantity.mockResolvedValue(undefined);

        const result = await launchAttack(1, 2, [{ userUnitId: 1, quantity: 3 }]);

        expect(combatMissionsRepo.createMission).toHaveBeenCalled();
        expect(result.missionId).toBe(42);
        expect(result.distance).toBe(10);
        expect(result.arrivalTime).toEqual(arrivalTime);
    });
});

// ---------------------------------------------------------------------------
// processArrivingMissions – Kampfauflösung
// ---------------------------------------------------------------------------
describe('processArrivingMissions', () => {
    it('verarbeitet alle ankommenden Missionen ohne Fehler', async () => {
        const mission = {
            id: 1,
            attacker_id: 1,
            defender_id: 2,
            attacker_username: 'atk',
            defender_username: 'def',
            distance: 10,
        };
        combatMissionsRepo.findArrivingMissions.mockResolvedValue([mission]);
        combatMissionsRepo.findMissionUnits.mockResolvedValue([
            {
                id: 10,
                user_unit_id: 1,
                unit_name: 'Infanterist',
                category: 'infantry',
                quantity_sent: 5,
                attack_points: 10,
                health_percentage: 100,
                counter_unit: null,
                movement_speed: 2,
            },
        ]);
        unitsRepo.findCombatUnitsByUser.mockResolvedValue([
            {
                id: 20,
                unit_name: 'Schütze',
                category: 'infantry',
                quantity: 3,
                defense_points: 8,
                health_percentage: 100,
            },
        ]);
        combatMissionsRepo.setMissionUnitReturned.mockResolvedValue(undefined);
        unitsRepo.setUserUnitQuantity.mockResolvedValue(undefined);
        unitsRepo.setUnitHealth.mockResolvedValue(undefined);
        combatMissionsRepo.updateMissionAfterCombat.mockResolvedValue(undefined);
        calcArrivalTime.mockReturnValue(new Date('2026-01-01T00:20:00Z'));

        await expect(processArrivingMissions()).resolves.toBeUndefined();
        expect(combatMissionsRepo.updateMissionAfterCombat).toHaveBeenCalledWith(
            1,
            'traveling_back',
            expect.objectContaining({ attackerWon: expect.any(Boolean) }),
            expect.any(Date),
            {}
        );
    });

    it('loggt Fehler bei einzelner Mission ohne andere zu blockieren', async () => {
        combatMissionsRepo.findArrivingMissions.mockResolvedValue([{ id: 1, attacker_id: 1, defender_id: 2, distance: 10 }]);
        combatMissionsRepo.findMissionUnits.mockRejectedValue(new Error('DB error'));

        await expect(processArrivingMissions()).resolves.toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// processReturningMissions – Rückkehr
// ---------------------------------------------------------------------------
describe('processReturningMissions', () => {
    it('gibt Einheiten zurück und schließt Mission ab', async () => {
        const mission = { id: 1, attacker_id: 1, defender_username: 'def' };
        combatMissionsRepo.findReturningMissions.mockResolvedValue([mission]);
        combatMissionsRepo.findMissionUnits.mockResolvedValue([
            { id: 10, user_unit_id: 1, quantity_returned: 3 },
        ]);
        unitsRepo.addUnitQuantity.mockResolvedValue(undefined);
        combatMissionsRepo.completeMission.mockResolvedValue(undefined);

        await expect(processReturningMissions()).resolves.toBeUndefined();
        expect(unitsRepo.addUnitQuantity).toHaveBeenCalledWith(1, 3, {});
        expect(combatMissionsRepo.completeMission).toHaveBeenCalledWith(1, {});
    });

    it('überspringt Einheiten mit quantity_returned = 0', async () => {
        combatMissionsRepo.findReturningMissions.mockResolvedValue([
            { id: 1, attacker_id: 1, defender_username: 'def' },
        ]);
        combatMissionsRepo.findMissionUnits.mockResolvedValue([
            { id: 10, user_unit_id: 1, quantity_returned: 0 },
        ]);
        combatMissionsRepo.completeMission.mockResolvedValue(undefined);

        await processReturningMissions();
        expect(unitsRepo.addUnitQuantity).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// Abfrage-Funktionen
// ---------------------------------------------------------------------------
describe('getActiveMissions', () => {
    it('delegiert an combatMissionsRepo.findActiveMissionsByAttacker', async () => {
        const fakeMissions = [{ id: 1 }];
        combatMissionsRepo.findActiveMissionsByAttacker.mockResolvedValue(fakeMissions);
        const result = await getActiveMissions(5);
        expect(combatMissionsRepo.findActiveMissionsByAttacker).toHaveBeenCalledWith(5);
        expect(result).toEqual(fakeMissions);
    });
});

describe('getIncomingAttacks', () => {
    it('delegiert an combatMissionsRepo.findIncomingMissionsByDefender', async () => {
        combatMissionsRepo.findIncomingMissionsByDefender.mockResolvedValue([]);
        await getIncomingAttacks(3);
        expect(combatMissionsRepo.findIncomingMissionsByDefender).toHaveBeenCalledWith(3);
    });
});

describe('getMissionHistory', () => {
    it('delegiert an combatMissionsRepo.findMissionHistory', async () => {
        combatMissionsRepo.findMissionHistory.mockResolvedValue([]);
        await getMissionHistory(7);
        expect(combatMissionsRepo.findMissionHistory).toHaveBeenCalledWith(7);
    });
});

// ---------------------------------------------------------------------------
// Kampftaucher-Sonderregel
// ---------------------------------------------------------------------------
describe('Kampftaucher-Sonderregel', () => {
    it('neutralisiert defense-Einheiten des Verteidigers', async () => {
        const mission = {
            id: 5,
            attacker_id: 1,
            defender_id: 2,
            attacker_username: 'atk',
            defender_username: 'def',
            distance: 5,
        };
        combatMissionsRepo.findArrivingMissions.mockResolvedValue([mission]);
        combatMissionsRepo.findMissionUnits.mockResolvedValue([
            {
                id: 1,
                user_unit_id: 1,
                unit_name: 'Kampftaucher',
                category: 'infantry',
                quantity_sent: 2,
                attack_points: 15,
                health_percentage: 100,
                counter_unit: null,
                movement_speed: 1,
            },
        ]);
        unitsRepo.findCombatUnitsByUser.mockResolvedValue([
            {
                id: 30,
                unit_name: 'Küstengeschütz',
                category: 'defense',
                quantity: 5,
                defense_points: 20,
                health_percentage: 100,
            },
        ]);
        combatMissionsRepo.setMissionUnitReturned.mockResolvedValue(undefined);
        unitsRepo.setUserUnitQuantity.mockResolvedValue(undefined);
        unitsRepo.setUnitHealth.mockResolvedValue(undefined);
        combatMissionsRepo.updateMissionAfterCombat.mockResolvedValue(undefined);

        await processArrivingMissions();

        // Kampftaucher → defense wird neutralisiert → defensePower = 0
        const call = combatMissionsRepo.updateMissionAfterCombat.mock.calls[0];
        const combatResult = call[2];
        expect(combatResult.kampftaucherUsed).toBe(true);
        // Wenn defense neutralisiert: defensePower sollte 0 sein
        expect(combatResult.defensePower).toBe(0);
    });
});
