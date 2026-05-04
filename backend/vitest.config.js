import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        env: {
            JWT_SECRET: 'test-secret-placeholder-at-least-32-chars!!',
        },
        exclude: ['tests/e2e/**', 'node_modules/**'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'lcov'],
            reportsDirectory: './coverage',
            include: ['services/**/*.js'],
            exclude: [
                'services/buildings.service.js',
                'services/gameloop.js',
                'services/live-updates.service.js',
            ],
            thresholds: {
                lines: 80,
                functions: 80,
                branches: 60,
                statements: 80,
            },
        },
    },
});
