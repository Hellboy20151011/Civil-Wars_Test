/**
 * Spieler-Initialisierung - Erstellt neue Spieler mit Starterressourcen und Rathaus
 */

import * as playerRepo from '../repositories/player.repository.js';
import * as resourcesRepo from '../repositories/resources.repository.js';
import * as buildingRepo from '../repositories/building.repository.js';
import * as unitsRepo from '../repositories/units.repository.js';
import * as economyService from './economy.service.js';
import * as combatService from './combat.service.js';
import * as espionageService from './espionage.service.js';
import { withTransaction } from '../repositories/transaction.repository.js';
import { logger } from '../logger.js';

export async function initializeNewPlayer(userId, username) {
    return withTransaction(async (client) => {
        await resourcesRepo.initForUser(userId, client);

        const rathaus = await buildingRepo.findTypeByName('Rathaus', client);
        if (rathaus) {
            await buildingRepo.createReadyBuildingAtLocation(userId, rathaus.id, 0, 0, client);
        }

        return {
            success: true,
            message: `Spieler '${username}' initialisiert mit Starterressourcen und Rathaus`,
        };
    });
}

/**
 * Tick-System ausführen - Wird regelmäßig aufgerufen (10 Min oder 1 Min im Dev)
 * Führt Ressourcenproduktion durch und prüft fertige Gebäude/Einheiten
 */
export async function executeTick() {
    try {
        const users = await playerRepo.findAllIds();

        for (const user of users) {
            await withTransaction(async (client) => {
                await economyService.applyProductionTicks(user.id, client);
                await economyService.processFinishedQueue(user.id, client);
                await unitsRepo.arriveDueUnitsByUser(user.id, new Date(), client);
            });
        }

        // Kampf-Missionen global verarbeiten (missionsübergreifend, eigene Transaktionen)
        await combatService.processArrivingMissions();
        await combatService.processReturningMissions();

        // Spionage-Missionen global verarbeiten
        await espionageService.processArrivingSpyMissions();
        await espionageService.processReturningSpyMissions();

        logger.info({ playersProcessed: users.length }, 'Tick executed successfully');
        return { success: true, playersProcessed: users.length };
    } catch (error) {
        logger.error({ err: error }, 'Tick execution failed');
        throw error;
    }
}
