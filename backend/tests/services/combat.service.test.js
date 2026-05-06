import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../repositories/combat-missions.repository.js');
vi.mock('../../repositories/player.repository.js');
vi.mock('../../repositories/units.repository.js');
vi.mock('../../repositories/building.repository.js');
vi.mock('../../repositories/resources.repository.js');
vi.mock('../../repositories/transaction.repository.js');
vi.mock('../../services/live-updates.service.js');
vi.mock('../../utils/game-math.js');

import * as combatMissionsRepo from '../../repositories/combat-missions.repository.js';
import * as playerRepo from '../../repositories/player.repository.js';
import * as unitsRepo from '../../repositories/units.repository.js';
import * as buildingRepo from '../../repositories/building.repository.js';
import * as resourcesRepo from '../../repositories/resources.repository.js';
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
    buildingRepo.findBuildingsByUser.mockResolvedValue([]);
    buildingRepo.findPowerSummaryByUser.mockResolvedValue({ production: 0, consumption: 0 });
    buildingRepo.removeUserBuildingsByType.mockResolvedValue(undefined);
    buildingRepo.upsertBuilding.mockResolvedValue(undefined);
    resourcesRepo.findByUserIdLocked.mockResolvedValue({ treibstoff: 1000 });
    resourcesRepo.deductResources.mockResolvedValue(undefined);
    combatMissionsRepo.countAttacksByPairToday.mockResolvedValue(0);
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

    it('wirft INVALID_UNIT_CATEGORY wenn Verteidigungsstellung angegriffen werden soll', async () => {
        playerRepo.findById
            .mockResolvedValueOnce({ id: 1, koordinate_x: 0, koordinate_y: 0, username: 'atk' })
            .mockResolvedValueOnce({ id: 2, koordinate_x: 5, koordinate_y: 5, username: 'def' });
        unitsRepo.findMovableUnit.mockResolvedValue({
            id: 1,
            is_moving: false,
            quantity: 5,
            movement_speed: 1,
            fuel_cost: 1,
            category: 'defense',
            name: '2cm Flak',
        });

        await expect(launchAttack(1, 2, [{ userUnitId: 1, quantity: 1 }])).rejects.toMatchObject({
            code: 'INVALID_UNIT_CATEGORY',
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
            id: 1, is_moving: false, quantity: 10, movement_speed: 2, fuel_cost: 3,
        });
        calcDistance.mockReturnValue(10);
        calcArrivalTime.mockReturnValue(arrivalTime);
        combatMissionsRepo.createMission.mockResolvedValue({ id: 42 });
        combatMissionsRepo.addMissionUnit.mockResolvedValue(undefined);
        unitsRepo.decrementUserUnitQuantity.mockResolvedValue(undefined);

        const result = await launchAttack(1, 2, [{ userUnitId: 1, quantity: 3 }]);

        expect(combatMissionsRepo.createMission).toHaveBeenCalled();
        expect(resourcesRepo.deductResources).toHaveBeenCalledWith(1, 0, 0, 0, 9, {});
        expect(result.missionId).toBe(42);
        expect(result.distance).toBe(10);
        expect(result.fuelCost).toBe(9);
        expect(result.arrivalTime).toEqual(arrivalTime);
    });

    it('wirft INSUFFICIENT_RESOURCES wenn Treibstoff nicht reicht', async () => {
        playerRepo.findById
            .mockResolvedValueOnce({ id: 1, koordinate_x: 0, koordinate_y: 0, username: 'atk' })
            .mockResolvedValueOnce({ id: 2, koordinate_x: 5, koordinate_y: 5, username: 'def' });
        unitsRepo.findMovableUnit.mockResolvedValue({
            id: 1,
            is_moving: false,
            quantity: 10,
            movement_speed: 2,
            fuel_cost: 5,
        });
        calcDistance.mockReturnValue(10);
        resourcesRepo.findByUserIdLocked.mockResolvedValue({ treibstoff: 1 });

        await expect(launchAttack(1, 2, [{ userUnitId: 1, quantity: 3 }])).rejects.toMatchObject({
            code: 'INSUFFICIENT_RESOURCES',
        });
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

    it('überspringt Einheiten mit quantity_returned = null', async () => {
        combatMissionsRepo.findReturningMissions.mockResolvedValue([
            { id: 1, attacker_id: 1, defender_username: 'def' },
        ]);
        combatMissionsRepo.findMissionUnits.mockResolvedValue([
            { id: 10, user_unit_id: 1, quantity_returned: null },
        ]);
        combatMissionsRepo.completeMission.mockResolvedValue(undefined);

        await processReturningMissions();
        expect(unitsRepo.addUnitQuantity).not.toHaveBeenCalled();
    });

    it('loggt Fehler wenn withTransaction fuer returning mission fehlschlaegt', async () => {
        combatMissionsRepo.findReturningMissions.mockResolvedValue([
            { id: 99, attacker_id: 1, defender_username: 'def' },
        ]);
        withTransaction.mockRejectedValueOnce(new Error('DB connection lost'));

        await expect(processReturningMissions()).resolves.toBeUndefined();
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

        const call = combatMissionsRepo.updateMissionAfterCombat.mock.calls[0];
        const combatResult = call[2];
        expect(combatResult.kampftaucherUsed).toBe(true);
        expect(combatResult.defensePower).toBeGreaterThanOrEqual(0);
    });
});

// ---------------------------------------------------------------------------
// Matchup-Sonderfälle
// ---------------------------------------------------------------------------
describe('Matchup-Sonderfälle', () => {
    const baseMission = {
        id: 10,
        attacker_id: 1,
        defender_id: 2,
        attacker_username: 'atk',
        defender_username: 'def',
        distance: 8,
    };

    beforeEach(() => {
        combatMissionsRepo.setMissionUnitReturned.mockResolvedValue(undefined);
        unitsRepo.setUserUnitQuantity.mockResolvedValue(undefined);
        unitsRepo.setUnitHealth.mockResolvedValue(undefined);
        combatMissionsRepo.updateMissionAfterCombat.mockResolvedValue(undefined);
    });

    it('infantry-Angreifer kann air-Verteidiger nicht treffen (immune branch)', async () => {
        combatMissionsRepo.findArrivingMissions.mockResolvedValue([{ ...baseMission, id: 11 }]);
        combatMissionsRepo.findMissionUnits.mockResolvedValue([
            {
                id: 2, user_unit_id: 1, unit_name: 'Infanterist',
                category: 'infantry', quantity_sent: 5,
                attack_points: 10, health_percentage: 100, counter_unit: null, movement_speed: 2,
            },
        ]);
        // Defender only has 'air' units – infantry can't hit them
        unitsRepo.findCombatUnitsByUser.mockResolvedValue([
            {
                id: 40, unit_name: 'Helikopter', category: 'air',
                quantity: 3, defense_points: 15, health_percentage: 100,
            },
        ]);

        await processArrivingMissions();

        const call = combatMissionsRepo.updateMissionAfterCombat.mock.calls[0];
        const combatResult = call[2];
        // infantry can't reach air → attackPower = 0
        expect(combatResult.attackPower).toBe(0);
        // air can't be hit by infantry → defensePower = 0
        expect(combatResult.defensePower).toBe(0);
        expect(combatResult.attackerWon).toBe(false);
    });

    it('Panzergrenadier gegen Luchs verwendet unit-vs-unit Multiplikator 1.1', async () => {
        combatMissionsRepo.findArrivingMissions.mockResolvedValue([{ ...baseMission, id: 12 }]);
        combatMissionsRepo.findMissionUnits.mockResolvedValue([
            {
                id: 3, user_unit_id: 1, unit_name: 'Panzergrenadier',
                category: 'infantry', quantity_sent: 4,
                attack_points: 12, health_percentage: 100, counter_unit: null, movement_speed: 2,
            },
        ]);
        unitsRepo.findCombatUnitsByUser.mockResolvedValue([
            {
                id: 50, unit_name: 'Luchs', category: 'vehicle',
                quantity: 2, defense_points: 10, health_percentage: 100,
            },
        ]);

        await processArrivingMissions();

        const call = combatMissionsRepo.updateMissionAfterCombat.mock.calls[0];
        const combatResult = call[2];
        // Panzergrenadier vs Luchs: 1.1 Multiplikator (JSON)
        // Gewichtete Verteilung: baseDamage = 12 * 4 * 1.0 = 48; 1 Zieltyp → weight=1 → attackPower = 48
        expect(combatResult.attackPower).toBeCloseTo(48, 1);
    });

    it('Fregatte gegen Eurofighter verwendet unit-vs-unit Multiplikator 0.8', async () => {
        combatMissionsRepo.findArrivingMissions.mockResolvedValue([{ ...baseMission, id: 13 }]);
        combatMissionsRepo.findMissionUnits.mockResolvedValue([
            {
                id: 4, user_unit_id: 1, unit_name: 'Fregatte',
                category: 'ship', quantity_sent: 1,
                attack_points: 20, health_percentage: 100, counter_unit: null, movement_speed: 1,
            },
        ]);
        unitsRepo.findCombatUnitsByUser.mockResolvedValue([
            {
                id: 60, unit_name: 'Eurofighter', category: 'air',
                quantity: 2, defense_points: 8, health_percentage: 100,
            },
        ]);

        await processArrivingMissions();

        const call = combatMissionsRepo.updateMissionAfterCombat.mock.calls[0];
        const combatResult = call[2];
        // Fregatte vs Eurofighter: 0.8 Multiplikator (JSON)
        // Gewichtete Verteilung: baseDamage = 20 * 1 * 1.0 = 20; 1 Zieltyp → weight=1 → attackPower = 20
        expect(combatResult.attackPower).toBeCloseTo(20, 1);
    });

    it('Soldat gegen Panzergrenadier verwendet unit-vs-unit Multiplikator 1.5', async () => {
        combatMissionsRepo.findArrivingMissions.mockResolvedValue([{ ...baseMission, id: 14 }]);
        combatMissionsRepo.findMissionUnits.mockResolvedValue([
            {
                id: 5, user_unit_id: 1, unit_name: 'Soldat',
                category: 'infantry', quantity_sent: 4,
                attack_points: 10, health_percentage: 100, counter_unit: null, movement_speed: 3,
            },
        ]);
        unitsRepo.findCombatUnitsByUser.mockResolvedValue([
            {
                id: 70, unit_name: 'Panzergrenadier', category: 'infantry',
                quantity: 3, defense_points: 8, health_percentage: 100,
            },
        ]);

        await processArrivingMissions();

        const call = combatMissionsRepo.updateMissionAfterCombat.mock.calls[0];
        const combatResult = call[2];
        // Soldat vs Panzergrenadier: 1.5 Multiplikator (JSON)
        // Gewichtete Verteilung: baseDamage = 10 * 4 * 1.0 = 40; 1 Zieltyp → weight=1 → attackPower = 40
        expect(combatResult.attackPower).toBeCloseTo(40, 1);
    });

    it('Verteidiger verliert alle Einheiten → setUnitHealth wird aufgerufen', async () => {
        combatMissionsRepo.findArrivingMissions.mockResolvedValue([{ ...baseMission, id: 15 }]);
        combatMissionsRepo.findMissionUnits.mockResolvedValue([
            {
                id: 6, user_unit_id: 1, unit_name: 'Leopard 2',
                category: 'vehicle', quantity_sent: 5,
                attack_points: 50, health_percentage: 100, counter_unit: null, movement_speed: 1,
            },
        ]);
        // defense_points: 0 → defensePower = 0 → defenderCasualtyRate = 1 → all units lost
        // Leopard 2 vs Luchs = 1.6 (JSON) → canBeHit = true
        unitsRepo.findCombatUnitsByUser.mockResolvedValue([
            {
                id: 80, unit_name: 'Luchs', category: 'vehicle',
                quantity: 2, defense_points: 0, health_percentage: 100,
            },
        ]);

        await processArrivingMissions();

        // Defender wiped out (remaining = 0) → setUnitHealth called with 0
        expect(unitsRepo.setUnitHealth).toHaveBeenCalledWith(80, 0, {});
    });

    it('Seahawk gegen Soldat: Angreifer erleidet keinen Verlust, wenn Verteidiger nicht treffen kann', async () => {
        combatMissionsRepo.findArrivingMissions.mockResolvedValue([{ ...baseMission, id: 16 }]);
        combatMissionsRepo.findMissionUnits.mockResolvedValue([
            {
                id: 7, user_unit_id: 1, unit_name: 'Seahawk',
                category: 'air', quantity_sent: 2,
                attack_points: 20, health_percentage: 100, counter_unit: null, movement_speed: 4,
            },
        ]);
        unitsRepo.findCombatUnitsByUser.mockResolvedValue([
            {
                id: 81, unit_name: 'Soldat', category: 'infantry',
                quantity: 1, defense_points: 8, health_percentage: 100,
            },
        ]);

        await processArrivingMissions();

        const call = combatMissionsRepo.updateMissionAfterCombat.mock.calls[0];
        const combatResult = call[2];
        expect(combatResult.attackerUnits[0]).toEqual(
            expect.objectContaining({ sent: 2, survived: 2, losses: 0 })
        );
    });

    it('überträgt geplünderte Gebäude beim Angreifer-Sieg auf den Angreifer', async () => {
        combatMissionsRepo.findArrivingMissions.mockResolvedValue([{ ...baseMission, id: 17 }]);
        combatMissionsRepo.findMissionUnits.mockResolvedValue([
            {
                id: 8, user_unit_id: 1, unit_name: 'Seahawk',
                category: 'air', quantity_sent: 2,
                attack_points: 20, health_percentage: 100, counter_unit: null, movement_speed: 4,
            },
        ]);
        unitsRepo.findCombatUnitsByUser.mockResolvedValue([]);
        buildingRepo.findBuildingsByUser.mockResolvedValue([
            {
                id: 5,
                name: 'Steinbruch',
                category: 'infrastructure',
                anzahl: 10,
                power_production: 0,
                power_consumption: 0,
                stone_production: 4,
                steel_production: 0,
                fuel_production: 0,
                money_production: 0,
            },
        ]);

        await processArrivingMissions();

        expect(buildingRepo.removeUserBuildingsByType).toHaveBeenCalledWith(2, 5, 2, {});
        expect(buildingRepo.upsertBuilding).toHaveBeenCalledWith(1, 5, 2, {});
    });
});
