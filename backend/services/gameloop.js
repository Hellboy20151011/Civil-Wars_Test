/**
 * Spieler-Initialisierung - Erstellt neue Spieler mit Starterressourcen und Rathaus
 */

import * as playerRepo from '../repositories/player.repository.js';
import * as resourcesRepo from '../repositories/resources.repository.js';
import * as buildingRepo from '../repositories/building.repository.js';
import * as unitsRepo from '../repositories/units.repository.js';
import * as economyService from './economy.service.js';
import { withTransaction } from '../repositories/transaction.repository.js';

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

        console.log(`[TICK] Ausgeführt für ${users.length} Spieler`);
        return { success: true, playersProcessed: users.length };
    } catch (error) {
        console.error('[TICK] Fehler:', error);
        throw error;
    }
}
