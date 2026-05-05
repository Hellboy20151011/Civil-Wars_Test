import express from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { config } from '../config.js';
import { asyncWrapper } from '../middleware/asyncWrapper.js';
import { validateBody } from '../middleware/validate.js';
import { authLimiter } from '../middleware/rateLimiters.js';
import * as playerRepo from '../repositories/player.repository.js';
import * as authService from '../services/auth.service.js';

const router = express.Router();

const JWT_SECRET = config.jwt.secret;
const registerSchema = z.object({
    username: z.string().min(3, 'Username muss mindestens 3 Zeichen lang sein'),
    email: z.string().email('Ungültige E-Mail-Adresse'),
    password: z.string().min(8, 'Passwort muss mindestens 8 Zeichen lang sein'),
});

const loginSchema = z.object({
    username: z.string().min(1, 'Username darf nicht leer sein'),
    password: z.string().min(1, 'Passwort darf nicht leer sein'),
});

const refreshSchema = z.object({
    refresh_token: z.string().min(20, 'refresh_token fehlt oder ist ungültig'),
});

// Registrierung eines neuen Benutzers
router.post(
    '/register',
    authLimiter,
    validateBody(registerSchema),
    asyncWrapper(async (req, res) => {
        const payload = await authService.registerUser(req.body);
        res.status(201).json(payload);
    })
);

// Login eines bestehenden Benutzers
router.post(
    '/login',
    authLimiter,
    validateBody(loginSchema),
    asyncWrapper(async (req, res) => {
        const payload = await authService.loginUser(req.body);
        res.status(200).json(payload);
    })
);

router.post(
    '/refresh',
    authLimiter,
    validateBody(refreshSchema),
    asyncWrapper(async (req, res) => {
        const payload = await authService.refreshAuthToken({ refreshToken: req.body.refresh_token });
        res.status(200).json(payload);
    })
);

/**
 * Prueft den Bearer-Token und schreibt den verifizierten Payload nach `req.user`.
 *
 * @param {import('express').Request} req - Express Request mit optionalem Authorization-Header.
 * @param {import('express').Response} res - Express Response fuer 401-Antworten bei Auth-Fehlern.
 * @param {import('express').NextFunction} next - Gibt den Kontrollfluss an den naechsten Handler weiter.
 * @returns {void}
 * @sideEffects Mutiert `req.user` bei erfolgreicher Verifikation.
 */
export function requireAuth(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
        return res.status(401).json({ message: 'No token provided' });
    }

    try {
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    } catch {
        return res.status(401).json({ message: 'Invalid or expired token' });
    }
}

// Gibt den eingeloggten User anhand des Tokens zurück
router.get(
    '/me',
    requireAuth,
    asyncWrapper(async (req, res) => {
        const user = await playerRepo.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json({ user });
    })
);

export default router;
