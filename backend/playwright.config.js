import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './tests/e2e',
    timeout: 30_000,
    retries: 0,
    use: {
        baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
        extraHTTPHeaders: {
            'Content-Type': 'application/json',
        },
    },
    // Kein Browser-Start nötig – wir testen nur die REST-API
    projects: [
        {
            name: 'api',
        },
    ],
});
