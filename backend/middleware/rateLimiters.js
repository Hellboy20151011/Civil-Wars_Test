import rateLimit from 'express-rate-limit';

// Strenger Limiter für Login/Register – schützt vor Brute-Force
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 Minuten
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Zu viele Anfragen. Bitte in 15 Minuten erneut versuchen.' },
});

// Normaler API-Limiter für Spiel-Endpunkte
export const apiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 Minute
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Zu viele Anfragen.' },
});
