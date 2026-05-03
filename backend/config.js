/**
 * Zentrale Konfigurationsschicht – liest alle Umgebungsvariablen an einem Ort
 * und validiert kritische Werte beim Server-Start.
 */

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
    },

    cors: {
        origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
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

    nodeEnv: process.env.NODE_ENV || 'development',
};
