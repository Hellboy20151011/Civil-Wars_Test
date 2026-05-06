/**
 * Seed-Script: Erstellt Test-NPCs in der Datenbank.
 *
 * Verwendung:
 *   node backend/scripts/seed-npcs.js
 *
 * Die NPCs werden nur erstellt wenn sie noch nicht existieren (Username-Check).
 */

import pool from '../database/db.js';
import { withTransaction } from '../repositories/transaction.repository.js';
import * as npcRepo from '../repositories/npc.repository.js';
import * as playerRepo from '../repositories/player.repository.js';
import * as resourcesRepo from '../repositories/resources.repository.js';
import * as buildingRepo from '../repositories/building.repository.js';

const GRID_SIZE = Number(process.env.MAP_GRID_SIZE) || 999;

const NPCS_TO_CREATE = [
    { username: 'KI-Verteidiger',  npcType: 'defensive'  },
    { username: 'KI-Angreifer',    npcType: 'aggressive' },
    { username: 'KI-Wächter',      npcType: 'defensive'  },
];

async function findFreeCoordinates(client) {
    const maxVersuche = 100;
    for (let i = 0; i < maxVersuche; i++) {
        const x = Math.floor(Math.random() * GRID_SIZE) + 1;
        const y = Math.floor(Math.random() * GRID_SIZE) + 1;
        const existing = await playerRepo.findByKoordinaten(x, y, client);
        if (!existing) return { x, y };
    }
    throw new Error('Keine freien Koordinaten gefunden');
}

async function seedNpc(npcDef) {
    // Prüfen ob NPC bereits existiert
    const existing = await pool.query('SELECT id FROM users WHERE username = $1', [npcDef.username]);
    if (existing.rows.length > 0) {
        console.log(`[SKIP] NPC "${npcDef.username}" existiert bereits (ID ${existing.rows[0].id})`);
        return;
    }

    await withTransaction(async (client) => {
        const { x, y } = await findFreeCoordinates(client);
        const npc = await npcRepo.createNpc(npcDef.username, npcDef.npcType, x, y, client);

        // Startressourcen (großzügiger als Spieler damit NPCs sofort loslegen können)
        await resourcesRepo.initForUser(npc.id, client);
        await client.query(
            `UPDATE user_resources
             SET amount = amount * 3
             WHERE user_id = $1`,
            [npc.id]
        );

        // Rathaus als Startgebäude
        const rathaus = await buildingRepo.findTypeByName('Rathaus', client);
        if (rathaus) {
            await buildingRepo.upsertBuilding(npc.id, rathaus.id, 1, client);
        }

        console.log(
            `[CREATED] NPC "${npcDef.username}" (ID ${npc.id}, Typ: ${npcDef.npcType}, Pos: ${x}/${y})`
        );
    });
}

async function main() {
    console.log('Starte NPC-Seeding...\n');
    for (const npcDef of NPCS_TO_CREATE) {
        await seedNpc(npcDef);
    }
    console.log('\nNPC-Seeding abgeschlossen.');
    await pool.end();
}

main().catch((err) => {
    console.error('Seed-Fehler:', err);
    process.exit(1);
});
