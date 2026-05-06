/**
 * Zentrale Konfigurationsschicht – liest alle Umgebungsvariablen an einem Ort
 * und validiert kritische Werte beim Server-Start.
 */

import 'dotenv/config';

const corsOriginRaw = process.env.CORS_ORIGIN || 'http://localhost:3000,http://localhost:5173';
const corsOrigins = corsOriginRaw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

const parseBoolean = (value, fallback = false) => {
    if (value == null) return fallback;
    return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
};

// JWT-Secret-Länge prüfen
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
    throw new Error('[Config] JWT_SECRET ist nicht gesetzt.');
}
if (jwtSecret.length < 32) {
    throw new Error('[Config] JWT_SECRET muss mindestens 32 Zeichen lang sein.');
}

export const config = {
    port: Number(process.env.PORT) || 3000,

    db: {
        user: process.env.DB_USER || 'postgres',
        host: process.env.DB_HOST || 'localhost',
        database: process.env.DB_NAME || 'civil_wars_test',
        password: process.env.DB_PASSWORD || '',
        port: Number(process.env.DB_PORT) || 5432,
        poolMax: Number(process.env.POOL_MAX) || 10,
    },

    jwt: {
        secret: jwtSecret,
        expiresIn: process.env.JWT_EXPIRES_IN || '7d',
        refreshExpiresInMs: Number(process.env.JWT_REFRESH_EXPIRES_IN_MS) || 30 * 24 * 60 * 60 * 1000,
    },

    cors: {
        origin: corsOrigins.length <= 1 ? (corsOrigins[0] ?? 'http://localhost:3000') : corsOrigins,
    },

    rateLimit: {
        // Auth-Limiter (Login/Register): Fenster in ms und max. Anfragen
        authWindowMs: Number(process.env.RATE_AUTH_WINDOW_MS) || 15 * 60 * 1000,
        authMax: Number(process.env.RATE_AUTH_MAX) || 20,
        // API-Limiter: Fenster in ms und max. Anfragen
        apiWindowMs: Number(process.env.RATE_API_WINDOW_MS) || 60 * 1000,
        apiMax: Number(process.env.RATE_API_MAX) || 120,
    },

    gameloop: {
        tickIntervalMs:
            Number(process.env.TICK_INTERVAL_MS) ||
            (process.env.NODE_ENV === 'production' ? 600_000 : 60_000),
    },

    performance: {
        referenceDataCacheTtlMs: Number(process.env.REFERENCE_DATA_CACHE_TTL_MS) || 300_000,
    },

    logging: {
        level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
    },

    docs: {
        enableSwaggerUi: parseBoolean(
            process.env.ENABLE_SWAGGER_UI,
            (process.env.NODE_ENV || 'development') !== 'production'
        ),
    },

    frontend: {
        preferDist: parseBoolean(
            process.env.FRONTEND_PREFER_DIST,
            (process.env.NODE_ENV || 'development') === 'production'
        ),
    },

    map: {
        // Koordinatenbereich: 1–MAP_GRID_SIZE (Standard: 999 → ~998 000 mögliche Positionen)
        gridSize: Number(process.env.MAP_GRID_SIZE) || 999,
        // Maximale sinnvolle Spielerzahl bei ~0,1 % Auslastung des Gitters
        maxPlayers: Number(process.env.MAP_MAX_PLAYERS) || 1000,
    },

    security: {
        // Anzahl fehlgeschlagener Login-Versuche bevor Account gesperrt wird
        maxFailedLogins: Number(process.env.MAX_FAILED_LOGINS) || 5,
        // Sperrdauer in ms (Standard: 15 Minuten)
        lockoutDurationMs: Number(process.env.LOCKOUT_DURATION_MS) || 15 * 60 * 1000,
    },

    nodeEnv: process.env.NODE_ENV || 'development',
};
