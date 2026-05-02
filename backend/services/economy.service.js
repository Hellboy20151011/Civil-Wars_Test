import * as buildingRepo from '../repositories/building.repository.js';
import * as resourcesRepo from '../repositories/resources.repository.js';

// Tick-Dauer in Millisekunden (1 Minute)
const TICK_MS = 60 * 1000;

/**
 * Berechnet Strom-Status aus den gebauten Gebäuden.
 * Gibt { produktion, verbrauch, frei } zurück.
 */
export async function getStromStatus(userId, client) {
    const buildings = await buildingRepo.findBuildingsByUser(userId, client);
    let produktion = 0;
    let verbrauch = 0;
    for (const b of buildings) {
        produktion += Number(b.power_production) * Number(b.anzahl);
        verbrauch  += Number(b.power_consumption) * Number(b.anzahl);
    }
    return { produktion, verbrauch, frei: produktion - verbrauch };
}

/**
 * Berechnet wie viel jede Ressource pro Tick produziert wird.
 */
export async function getProductionPerTick(userId, client) {
    const buildings = await buildingRepo.findBuildingsByUser(userId, client);
    let geld = 0, stein = 0, eisen = 0, treibstoff = 0, bevoelkerung = 0;
    for (const b of buildings) {
        const n = Number(b.anzahl);
        geld       += Number(b.money_production) * n;
        stein      += Number(b.stone_production) * n;
        eisen      += Number(b.iron_production)  * n;
        treibstoff += Number(b.fuel_production)  * n;
        bevoelkerung += Number(b.population)     * n;
    }
    return { geld, stein, eisen, treibstoff, bevoelkerung };
}

/**
 * Wendet ausstehende Produktions-Ticks auf die Ressourcen an (lazy – wird bei jedem Request gemacht).
 * Gibt die Anzahl der verarbeiteten Ticks zurück.
 */
export async function applyProductionTicks(userId, client) {
    const resources = await resourcesRepo.findByUserIdLocked(userId, client);
    if (!resources) return 0;

    const now = new Date();
    const elapsed = now.getTime() - new Date(resources.letzte_aktualisierung).getTime();
    const ticks = Math.floor(elapsed / TICK_MS);
    if (ticks <= 0) return 0;

    const production = await getProductionPerTick(userId, client);

    await resourcesRepo.addResources(
        userId,
        production.geld       * ticks,
        production.stein      * ticks,
        production.eisen      * ticks,
        production.treibstoff * ticks,
        new Date(new Date(resources.letzte_aktualisierung).getTime() + ticks * TICK_MS),
        client
    );

    return ticks;
}

/**
 * Verarbeitet fertige Bauaufträge: bucht sie als Gebäude ein und löscht sie aus der Queue.
 */
export async function processFinishedQueue(userId, client) {
    const finished = await buildingRepo.findFinishedQueueEntries(userId, client);
    for (const entry of finished) {
        await buildingRepo.upsertBuilding(userId, entry.building_type_id, entry.anzahl, client);
    }
    if (finished.length > 0) {
        await buildingRepo.deleteFinishedQueueEntries(userId, client);
    }
    return finished.length;
}

/**
 * Aggregiert den vollständigen Spielerstatus für das Frontend.
 */
export async function getSpielerStatus(userId, client) {
    const resources = await resourcesRepo.findByUserId(userId, client);
    const buildings = await buildingRepo.findBuildingsByUser(userId, client);
    const queue     = await buildingRepo.findQueueByUser(userId, client);
    const strom     = await getStromStatus(userId, client);
    const production = await getProductionPerTick(userId, client);

    let bevoelkerung = 0;
    for (const b of buildings) {
        bevoelkerung += Number(b.population) * Number(b.anzahl);
    }

    return {
        resources: resources ?? { geld: 0, stein: 0, eisen: 0, treibstoff: 0 },
        buildings,
        queue,
        strom,
        production,
        bevoelkerung,
    };
}
