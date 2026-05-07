import { defineConfig } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Lädt explizit backend/.env, auch wenn Playwright aus einem anderen cwd gestartet wird.
dotenv.config({ path: path.join(__dirname, '.env') });

// Stellt sicher, dass Backend-Module, die in E2E-Tests direkt importiert werden,
// config.js problemlos laden können.
if (!process.env.JWT_SECRET) {
    process.env.JWT_SECRET = 'e2e-test-secret-placeholder-at-least-32-chars!!';
}

// E2E-Dateien mit direktem DB-Zugriff (pg Pool) brauchen auch im Test-Worker
// konsistente DB-Env-Werte, nicht nur im laufenden Backend-Prozess.
if (!process.env.DB_PASSWORD) {
    process.env.DB_PASSWORD = '';
}

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
