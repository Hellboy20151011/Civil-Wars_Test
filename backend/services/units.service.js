/**
 * Units Service - Handhabt Einheitenausbildung und Verwaltung
 */

import { hasEnoughResources, deductResources } from './buildings.service.js';
import * as unitsRepo from '../repositories/units.repository.js';
import { withTransaction } from '../repositories/transaction.repository.js';
import { createServiceError } from './service-error.js';
import * as researchService from './research.service.js';

function getDefenseResearchRequirementLevel(buildingRequirement) {
    const match = String(buildingRequirement ?? '').match(/Level\s*(\d+)/i);
    const parsed = Number(match?.[1] ?? 1);
    if (!Number.isFinite(parsed)) return 1;
    return Math.min(3, Math.max(1, parsed));
}

// ─────────────────────────────────────────────────────────────────────────────
// GET: Einheiten abrufen
// ─────────────────────────────────────────────────────────────────────────────

export async function getUserUnits(userId) {
    return unitsRepo.findDetailedByUser(userId);
}

export async function getUnitTypeByName(name) {
    return unitsRepo.findTypeByName(name);
}

export async function getUnitById(unitTypeId) {
    return unitsRepo.findTypeById(unitTypeId);
}

// ─────────────────────────────────────────────────────────────────────────────
// TRAIN: Einheiten ausbilden
// ─────────────────────────────────────────────────────────────────────────────

export async function startTraining(userId, unitTypeId, quantity = 1) {
    return withTransaction(async (client) => {
        const unitType = await unitsRepo.findTypeById(unitTypeId, client);
        if (!unitType) throw createServiceError('Einheitentyp nicht gefunden', 404, 'UNIT_TYPE_NOT_FOUND');

        if (unitType.category === 'defense') {
            const requiredLevel = getDefenseResearchRequirementLevel(unitType.building_requirement);
            const availableLevel = await researchService.getDefenseResearchLevel(userId, client);
            if (availableLevel < requiredLevel) {
                throw createServiceError(
                    `Verteidigungsforschung Level ${requiredLevel} erforderlich`,
                    400,
                    'RESEARCH_REQUIRED'
                );
            }
        } else {
            const readyBuildingCount = await unitsRepo.findReadyBuildingCountByName(
                userId,
                unitType.building_requirement,
                client
            );
            if (readyBuildingCount === 0) {
                throw createServiceError(
                    `Gebäude '${unitType.building_requirement}' nicht gefunden oder noch in Konstruktion`,
                    400,
                    'BUILDING_REQUIRED'
                );
            }
        }

        const totalCosts = {
            money: unitType.money_cost * quantity,
            steel: unitType.steel_cost * quantity,
            fuel: unitType.fuel_cost * quantity,
        };

        const hasResources = await hasEnoughResources(userId, totalCosts, client);
        if (!hasResources) throw createServiceError('Nicht genug Ressourcen für Ausbildung', 400, 'INSUFFICIENT_RESOURCES');

        await deductResources(userId, totalCosts, client);

        const existingUnit = await unitsRepo.findUserUnitByType(userId, unitTypeId, client);

        if (existingUnit) {
            await unitsRepo.incrementUserUnitQuantity(userId, unitTypeId, quantity, client);
        } else {
            await unitsRepo.createUserUnit(userId, unitTypeId, quantity, client);
        }

        return {
            success: true,
            unit: unitType.name,
            quantity,
            totalCost: totalCosts,
            trainingTime: unitType.training_time_ticks * quantity,
        };
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// MOVE: Einheiten bewegen
// ─────────────────────────────────────────────────────────────────────────────

export async function moveUnits(userId, userUnitId, destinationX, destinationY) {
    return withTransaction(async (client) => {
        const unit = await unitsRepo.findMovableUnit(userUnitId, userId, client);
        if (!unit) throw createServiceError('Einheit nicht gefunden', 404, 'UNIT_NOT_FOUND');

        const distance = Math.sqrt(
            Math.pow(destinationX - unit.location_x, 2) +
                Math.pow(destinationY - unit.location_y, 2)
        );

        const travelTime = distance / unit.movement_speed;
        const arrivalTime = new Date(Date.now() + travelTime * 60 * 1000);

        await unitsRepo.setUnitMovement(userUnitId, destinationX, destinationY, arrivalTime, client);

        return {
            success: true,
            distance,
            travelTime,
            arrivalTime,
        };
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// ARRIVAL: Einheiten am Ziel ankommen lassen
// ─────────────────────────────────────────────────────────────────────────────

export async function arriveAtDestination(userUnitId) {
    return unitsRepo.arriveAtDestination(userUnitId);
}

// ─────────────────────────────────────────────────────────────────────────────
// ATTACK: Einheiten angreifen (vereinfacht)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Berechnet Kampfschaden zwischen zwei Einheiten und persistiert das Ergebnis.
 *
 * @param {number} attackingUnitId - ID der angreifenden Einheit (`user_units.id`).
 * @param {number} targetUnitId - ID der verteidigenden Einheit (`user_units.id`).
 * @returns {Promise<{
 *   success: boolean,
 *   baseDamage: number,
 *   actualDamage: number,
 *   targetHealth: number,
 *   targetDestroyed: boolean
 * }>} Ergebnis mit Basis- und Endschaden sowie Zielstatus.
 * @sideEffects Aktualisiert Ziel-Lebenspunkte/Menge und erhoeht Erfahrung des Angreifers.
 */
export async function attackUnits(attackingUnitId, targetUnitId) {
    return withTransaction(async (client) => {
        const [attacker, target] = await Promise.all([
            unitsRepo.findAttackerUnit(attackingUnitId, client),
            unitsRepo.findDefenderUnit(targetUnitId, client),
        ]);

        if (!attacker || !target) throw createServiceError('Einheit nicht gefunden', 404, 'UNIT_NOT_FOUND');

        const baseDamage = attacker.attack_points;
        const defenseReduction = target.defense_points * 0.5;
        const actualDamage = Math.max(1, baseDamage - defenseReduction);

        const healthLoss = (actualDamage / target.hitpoints) * 100;
        const newHealth = Math.max(0, target.health_percentage - healthLoss);

        await unitsRepo.updateUnitHealth(targetUnitId, newHealth, client);

        if (newHealth <= 0) {
            await unitsRepo.zeroUnitQuantity(targetUnitId, client);
        }

        await unitsRepo.addUnitExperience(attackingUnitId, 10, client);

        return {
            success: true,
            baseDamage,
            actualDamage,
            targetHealth: newHealth,
            targetDestroyed: newHealth <= 0,
        };
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Unit Types auflisten
// ─────────────────────────────────────────────────────────────────────────────

export async function getAllUnitTypes() {
    return unitsRepo.findAllTypes();
}

export async function getUnitsByCategory(category) {
    return unitsRepo.findTypesByCategory(category);
}
