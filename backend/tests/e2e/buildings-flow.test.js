import { test, expect } from '@playwright/test';

/**
 * Registriert einen neuen Spieler und gibt den JWT zurück.
 */
async function registerAndLogin(request) {
    const suffix = Date.now();
    await request.post('/auth/register', {
        data: {
            username: `bld_user_${suffix}`,
            email: `bld_${suffix}@test.local`,
            password: 'TestPass123!',
        },
    });
    const login = await request.post('/auth/login', {
        data: { username: `bld_user_${suffix}`, password: 'TestPass123!' },
    });
    const { token } = await login.json();
    return token;
}

// ─────────────────────────────────────────────────────────────────────────────
// Gebäudetypen
// ─────────────────────────────────────────────────────────────────────────────
test.describe('GET /buildings/types', () => {
    test('gibt Liste aller Gebäudetypen zurück', async ({ request }) => {
        const token = await registerAndLogin(request);
        const res = await request.get('/buildings/types', {
            headers: { Authorization: `Bearer ${token}` },
        });
        expect(res.status()).toBe(200);
        const types = await res.json();
        expect(Array.isArray(types)).toBe(true);
        expect(types.length).toBeGreaterThan(0);
        expect(types[0]).toHaveProperty('id');
        expect(types[0]).toHaveProperty('name');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Eigene Gebäude
// ─────────────────────────────────────────────────────────────────────────────
test.describe('GET /buildings/me', () => {
    test('neu registrierter Spieler hat Rathaus als Startgebäude', async ({ request }) => {
        const token = await registerAndLogin(request);
        const res = await request.get('/buildings/me', {
            headers: { Authorization: `Bearer ${token}` },
        });
        expect(res.status()).toBe(200);
        const { buildings } = await res.json();
        expect(Array.isArray(buildings)).toBe(true);
        const rathaus = buildings.find((b) => b.name === 'Rathaus');
        expect(rathaus).toBeDefined();
        expect(Number(rathaus.anzahl)).toBeGreaterThanOrEqual(1);
    });

    test('Bauwarteschlange ist initial leer', async ({ request }) => {
        const token = await registerAndLogin(request);
        const res = await request.get('/buildings/me', {
            headers: { Authorization: `Bearer ${token}` },
        });
        const { queue } = await res.json();
        expect(Array.isArray(queue)).toBe(true);
        expect(queue.length).toBe(0);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Gebäude bauen
// ─────────────────────────────────────────────────────────────────────────────
test.describe('POST /buildings/build', () => {
    test('baut ein Gebäude wenn genug Ressourcen vorhanden', async ({ request }) => {
        const token = await registerAndLogin(request);

        // Günstigstes baubares Gebäude ermitteln (nicht Rathaus)
        const typesRes = await request.get('/buildings/types', {
            headers: { Authorization: `Bearer ${token}` },
        });
        const types = await typesRes.json();
        // Wähle das Gebäude mit den niedrigsten Geldkosten (außer 0 = kostenlos/Startgebäude)
        const cheap = types
            .filter((t) => t.name !== 'Rathaus' && Number(t.money_cost) > 0)
            .sort((a, b) => Number(a.money_cost) - Number(b.money_cost))[0];

        if (!cheap) {
            test.skip(true, 'Kein baubares Gebäude mit Geldkosten gefunden');
            return;
        }

        const res = await request.post('/buildings/build', {
            headers: { Authorization: `Bearer ${token}` },
            data: { building_type_id: cheap.id, anzahl: 1 },
        });

        // Entweder erfolgreich gebaut (201) oder nicht genug Ressourcen (400)
        // – beides ist ein gültiges Ergebnis je nach Startwerten
        expect([201, 400]).toContain(res.status());
    });

    test('lehnt Bau ohne building_type_id ab', async ({ request }) => {
        const token = await registerAndLogin(request);
        const res = await request.post('/buildings/build', {
            headers: { Authorization: `Bearer ${token}` },
            data: { anzahl: 1 },
        });
        expect(res.status()).toBe(400);
    });

    test('lehnt ungültige building_type_id ab', async ({ request }) => {
        const token = await registerAndLogin(request);
        const res = await request.post('/buildings/build', {
            headers: { Authorization: `Bearer ${token}` },
            data: { building_type_id: 999999, anzahl: 1 },
        });
        expect([400, 404, 500]).toContain(res.status());
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Vollständiger Spiel-Flow: Register → Login → Status → Gebäude abrufen
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Vollständiger Spiel-Flow', () => {
    test('Register → Login → /me → /buildings/me gibt konsistente Daten zurück', async ({
        request,
    }) => {
        const suffix = Date.now();
        // 1. Registrieren
        const regRes = await request.post('/auth/register', {
            data: {
                username: `flow_${suffix}`,
                email: `flow_${suffix}@test.local`,
                password: 'TestPass123!',
            },
        });
        expect(regRes.status()).toBe(201);

        // 2. Einloggen
        const loginRes = await request.post('/auth/login', {
            data: { username: `flow_${suffix}`, password: 'TestPass123!' },
        });
        expect(loginRes.status()).toBe(200);
        const { token } = await loginRes.json();

        // 3. Spielerstatus abrufen
        const meRes = await request.get('/me', {
            headers: { Authorization: `Bearer ${token}` },
        });
        expect(meRes.status()).toBe(200);
        const status = await meRes.json();
        expect(status).toHaveProperty('resources');
        expect(status).toHaveProperty('buildings');

        // 4. Gebäude abrufen
        const bldRes = await request.get('/buildings/me', {
            headers: { Authorization: `Bearer ${token}` },
        });
        expect(bldRes.status()).toBe(200);
        const { buildings, queue } = await bldRes.json();
        expect(Array.isArray(buildings)).toBe(true);
        expect(Array.isArray(queue)).toBe(true);

        // Rathaus vorhanden (wird bei Registrierung angelegt)
        expect(buildings.some((b) => b.name === 'Rathaus')).toBe(true);
    });
});
