import rateLimit from 'express-rate-limit';
import { config } from '../config.js';

function isPlaywrightRequest(req) {
    const userAgent = req.get('user-agent') ?? '';
    return /Playwright/i.test(userAgent);
}

function shouldSkipLimit(req) {
    if (config.nodeEnv === 'test') {
        return true;
    }

    // In lokalen/dev E2E-Läufen via Playwright keinen künstlichen 429 erzeugen.
    if (config.nodeEnv !== 'production' && isPlaywrightRequest(req)) {
        return true;
    }

    return false;
}

// Strenger Limiter für Login/Register – schützt vor Brute-Force
export const authLimiter = rateLimit({
    windowMs: config.rateLimit.authWindowMs,
    max: config.rateLimit.authMax,
    standardHeaders: true,
    legacyHeaders: false,
    skip: shouldSkipLimit,
    message: { message: 'Zu viele Anfragen. Bitte später erneut versuchen.' },
});

// Normaler API-Limiter für Spiel-Endpunkte
export const apiLimiter = rateLimit({
    windowMs: config.rateLimit.apiWindowMs,
    max: config.rateLimit.apiMax,
    standardHeaders: true,
    legacyHeaders: false,
    skip: shouldSkipLimit,
    message: { message: 'Zu viele Anfragen.' },
});
