import { test, expect } from '@playwright/test';

/**
 * Hilfsfunktion: Registrierung + Login in einem Schritt.
 * Gibt { token, userId } zurück.
 */
async function registerAndLogin(request, suffix = Date.now()) {
    const username = `e2e_user_${suffix}`;
    const email = `e2e_${suffix}@test.local`;
    const password = 'TestPass123!';

    const reg = await request.post('/auth/register', {
        data: { username, email, password },
    });
    expect(reg.status()).toBe(201);

    const login = await request.post('/auth/login', {
        data: { username, password },
    });
    expect(login.status()).toBe(200);
    const { token } = await login.json();
    expect(typeof token).toBe('string');
    return { token, username };
}

// ─────────────────────────────────────────────────────────────────────────────
// Registrierung
// ─────────────────────────────────────────────────────────────────────────────
test.describe('POST /auth/register', () => {
    test('registriert einen neuen Benutzer erfolgreich', async ({ request }) => {
        const suffix = Date.now();
        const res = await request.post('/auth/register', {
            data: {
                username: `reg_user_${suffix}`,
                email: `reg_${suffix}@test.local`,
                password: 'TestPass123!',
            },
        });
        expect(res.status()).toBe(201);
        const body = await res.json();
        expect(body).toHaveProperty('message');
    });

    test('lehnt doppelten Benutzernamen ab', async ({ request }) => {
        const suffix = Date.now();
        const data = {
            username: `dup_user_${suffix}`,
            email: `dup_${suffix}@test.local`,
            password: 'TestPass123!',
        };
        await request.post('/auth/register', { data });
        const res = await request.post('/auth/register', { data });
        expect(res.status()).toBe(400);
    });

    test('lehnt zu kurzes Passwort ab', async ({ request }) => {
        const res = await request.post('/auth/register', {
            data: {
                username: `short_pw_${Date.now()}`,
                email: `short_${Date.now()}@test.local`,
                password: 'abc',
            },
        });
        expect(res.status()).toBe(400);
    });

    test('lehnt ungültige E-Mail ab', async ({ request }) => {
        const res = await request.post('/auth/register', {
            data: {
                username: `inv_email_${Date.now()}`,
                email: 'kein-email',
                password: 'TestPass123!',
            },
        });
        expect(res.status()).toBe(400);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Login
// ─────────────────────────────────────────────────────────────────────────────
test.describe('POST /auth/login', () => {
    test('gibt JWT zurück bei korrekten Credentials', async ({ request }) => {
        const suffix = Date.now();
        await request.post('/auth/register', {
            data: {
                username: `login_ok_${suffix}`,
                email: `login_${suffix}@test.local`,
                password: 'TestPass123!',
            },
        });
        const res = await request.post('/auth/login', {
            data: { username: `login_ok_${suffix}`, password: 'TestPass123!' },
        });
        expect(res.status()).toBe(200);
        const body = await res.json();
        expect(body).toHaveProperty('token');
    });

    test('lehnt falsches Passwort ab', async ({ request }) => {
        const suffix = Date.now();
        await request.post('/auth/register', {
            data: {
                username: `wrong_pw_${suffix}`,
                email: `wpw_${suffix}@test.local`,
                password: 'TestPass123!',
            },
        });
        const res = await request.post('/auth/login', {
            data: { username: `wrong_pw_${suffix}`, password: 'WrongPassword!' },
        });
        expect(res.status()).toBe(401);
    });

    test('lehnt unbekannten Benutzernamen ab', async ({ request }) => {
        const res = await request.post('/auth/login', {
            data: { username: 'gibts_nicht_xyz', password: 'TestPass123!' },
        });
        expect(res.status()).toBe(401);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Geschützte Route ohne Token
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Authentifizierungsschutz', () => {
    test('GET /me gibt 401 ohne Token zurück', async ({ request }) => {
        const res = await request.get('/me');
        expect(res.status()).toBe(401);
    });

    test('GET /buildings/me gibt 401 ohne Token zurück', async ({ request }) => {
        const res = await request.get('/buildings/me');
        expect(res.status()).toBe(401);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Spielerstatus nach Registrierung
// ─────────────────────────────────────────────────────────────────────────────
test.describe('GET /me', () => {
    test('gibt Spielerstatus nach Registrierung zurück', async ({ request }) => {
        const { token } = await registerAndLogin(request);
        const res = await request.get('/me', {
            headers: { Authorization: `Bearer ${token}` },
        });
        expect(res.status()).toBe(200);
        const body = await res.json();
        expect(body).toHaveProperty('resources');
        expect(body).toHaveProperty('buildings');
    });

    test('Startressourcen sind vorhanden', async ({ request }) => {
        const { token } = await registerAndLogin(request);
        const res = await request.get('/me', {
            headers: { Authorization: `Bearer ${token}` },
        });
        const { resources } = await res.json();
        expect(resources).toHaveProperty('geld');
        expect(resources).toHaveProperty('stein');
        expect(resources).toHaveProperty('stahl');
        expect(resources).toHaveProperty('treibstoff');
        // Neu registrierte Spieler haben Startgeld > 0
        expect(Number(resources.geld)).toBeGreaterThan(0);
    });
});
