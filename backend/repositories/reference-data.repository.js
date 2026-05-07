import pool from '../database/db.js';
import { config } from '../config.js';

const ttlMs = config.performance.referenceDataCacheTtlMs;

const cache = {
    buildingTypes: { expiresAt: 0, value: [] },
    unitTypes: { expiresAt: 0, value: [] },
    resourceTypes: { expiresAt: 0, value: [] },
};

function isValid(entry) {
    return entry.expiresAt > Date.now() && Array.isArray(entry.value) && entry.value.length > 0;
}

async function getCached(entry, fetcher) {
    if (isValid(entry)) {
        return entry.value;
    }

    const rows = await fetcher();
    entry.value = rows;
    entry.expiresAt = Date.now() + ttlMs;
    return rows;
}

export async function getBuildingTypes(client = pool) {
    return getCached(cache.buildingTypes, async () => {
        const result = await client.query('SELECT * FROM building_types ORDER BY id');
        return result.rows;
    });
}

export async function getUnitTypes(client = pool) {
    return getCached(cache.unitTypes, async () => {
        const result = await client.query(
            "SELECT * FROM unit_types ORDER BY category, (REGEXP_REPLACE(building_requirement, '[^0-9]', '', 'g'))::INTEGER NULLS LAST, name"
        );
        return result.rows;
    });
}

export async function getResourceTypes(client = pool) {
    return getCached(cache.resourceTypes, async () => {
        const result = await client.query('SELECT id, name FROM resource_types ORDER BY id');
        return result.rows;
    });
}

export async function getResourceTypeIdByName(name, client = pool) {
    const types = await getResourceTypes(client);
    return types.find((entry) => entry.name === name)?.id ?? null;
}

/**
 * Leert alle Cache-Einträge sofort (z. B. nach Migrations-Seeds oder Tests).
 * Beim nächsten Zugriff werden die Daten neu aus der DB geladen.
 */
export function invalidateCache() {
    cache.buildingTypes.expiresAt = 0;
    cache.unitTypes.expiresAt = 0;
    cache.resourceTypes.expiresAt = 0;
}
