/**
 * NPC Einheitentraining
 *
 * Zuständig für das automatische Ausbilden von Infanteristen.
 * Trainiert höchstens bis MAX_STANDING_ARMY Soldaten auf einmal (kein Endlos-Training).
 */

import * as unitsRepo from '../../repositories/units.repository.js';
import * as unitsService from '../units.service.js';
import { logger } from '../../logger.js';
import { MAX_STANDING_ARMY } from './npc.config.js';

/**
 * Versucht, Infanteristen zu trainieren.
 * Gibt true zurück wenn Training gestartet wurde, sonst false.
 *
 * @param {number} npcId
 */
export async function tryTrainInfantry(npcId) {
    try {
        const units = await unitsRepo.findDetailedByUser(npcId);

        // Nur stehende (nicht bewegende) Einheiten zählen
        const totalSoldiers = units
            .filter((u) => !u.is_moving)
            .reduce((sum, u) => sum + Number(u.quantity), 0);

        // Armee bereits voll – kein Training nötig
        if (totalSoldiers >= MAX_STANDING_ARMY) return false;

        const trainCount = Math.min(5, MAX_STANDING_ARMY - totalSoldiers);
        const unitType = await unitsRepo.findTypeByName('Soldat');
        if (!unitType) return false;

        await unitsService.startTraining(npcId, unitType.id, trainCount);
        logger.info({ npcId, trainCount }, '[NPC] Infanteristen ausgebildet');
        return true;
    } catch {
        return false;
    }
}
