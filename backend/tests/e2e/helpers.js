import { expect } from '@playwright/test';

/**
 * Registriert einen neuen Testspieler und loggt ihn ein.
 *
 * @param {import('@playwright/test').APIRequestContext} request
 * @param {string} [prefix='e2e'] - Präfix für Username/E-Mail (für Lesbarkeit im Log)
 * @returns {Promise<{ token: string, refreshToken: string, username: string, userId: number }>}
 */
export async function registerAndLogin(request, prefix = 'e2e') {
    const suffix = `${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    const username = `${prefix}_${suffix}`;
    const email = `${prefix}_${suffix}@test.local`;
    const password = 'TestPass123!';

    const reg = await request.post('/auth/register', {
        data: { username, email, password },
    });
    expect(reg.status()).toBe(201);

    const login = await request.post('/auth/login', {
        data: { username, password },
    });
    expect(login.status()).toBe(200);
    const body = await login.json();
    expect(typeof body.token).toBe('string');

    return {
        token: body.token,
        refreshToken: body.refresh_token ?? null,
        username,
        userId: Number(body.user?.id ?? 0),
    };
}
