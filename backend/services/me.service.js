import * as economyService from './economy.service.js';
import { withTransaction } from '../repositories/transaction.repository.js';

export async function getPlayerStatus(userId) {
    return withTransaction(async (client) => {
        await economyService.applyProductionTicks(userId, client);
        await economyService.processFinishedQueue(userId, client);
        return economyService.getSpielerStatus(userId, client);
    });
}

export async function getStreamPayload(userId) {
    const status = await getPlayerStatus(userId);
    return { status, serverTime: new Date().toISOString() };
}
