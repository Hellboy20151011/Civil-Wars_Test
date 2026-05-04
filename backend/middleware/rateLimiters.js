import rateLimit from 'express-rate-limit';
import { config } from '../config.js';

// Strenger Limiter für Login/Register – schützt vor Brute-Force
export const authLimiter = rateLimit({
    windowMs: config.rateLimit.authWindowMs,
    max: config.rateLimit.authMax,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => config.nodeEnv === 'test',
    message: { message: 'Zu viele Anfragen. Bitte später erneut versuchen.' },
});

// Normaler API-Limiter für Spiel-Endpunkte
export const apiLimiter = rateLimit({
    windowMs: config.rateLimit.apiWindowMs,
    max: config.rateLimit.apiMax,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => config.nodeEnv === 'test',
    message: { message: 'Zu viele Anfragen.' },
});
