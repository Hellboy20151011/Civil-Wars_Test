import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { z } from 'zod';
import pool from '../database/db.js';
import { config } from '../config.js';
import { asyncWrapper } from '../middleware/asyncWrapper.js';
import { validateBody } from '../middleware/validate.js';
import { authLimiter } from '../middleware/rateLimiters.js';
import * as playerRepo from '../repositories/player.repository.js';
import * as resourcesRepo from '../repositories/resources.repository.js';
import * as buildingRepo from '../repositories/building.repository.js';
import * as refreshTokenRepo from '../repositories/refresh-token.repository.js';
import { withTransaction } from '../repositories/transaction.repository.js';

const router = express.Router();

const JWT_SECRET = config.jwt.secret;
const JWT_EXPIRES_IN = config.jwt.expiresIn;
const JWT_REFRESH_EXPIRES_IN_MS = config.jwt.refreshExpiresInMs;

/**
 * Erzeugt ein signiertes JWT fuer einen authentifizierten Benutzer.
 *
 * @param {{ id: number, username: string, role: string }} user - Minimaler User-Context fuer den Token-Payload.
 * @returns {string} Signiertes JWT mit konfigurierter Ablaufzeit.
 * @sideEffects Kryptografische Signatur mit dem serverseitigen JWT-Secret.
 */
function signAuthToken(user) {
    const payload = { id: user.id, username: user.username, role: user.role };
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function generateRefreshTokenValue() {
    return crypto.randomBytes(64).toString('hex');
}

function hashRefreshToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

async function issueRefreshToken(userId, client) {
    const refreshToken = generateRefreshTokenValue();
    const refreshTokenHash = hashRefreshToken(refreshToken);
    const expiresAt = new Date(Date.now() + JWT_REFRESH_EXPIRES_IN_MS);

    await refreshTokenRepo.createRefreshToken(userId, refreshTokenHash, expiresAt, client);

    return refreshToken;
}

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
        const { username, password, email } = req.body;

        const existing = await playerRepo.findByUsernameOrEmail(username, email);
        if (existing) {
            return res.status(400).json({ message: 'Username or email already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        // Freie Koordinaten suchen (bis zu 50 Versuche)
        let koordinateX,
            koordinateY,
            versuche = 0;
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            do {
                if (versuche >= 50) {
                    await client.query('ROLLBACK');
                    return res
                        .status(503)
                        .json({ message: 'Kein freier Koordinatenplatz verfügbar' });
                }
                koordinateX = Math.floor(Math.random() * 999) + 1;
                koordinateY = Math.floor(Math.random() * 999) + 1;
                versuche++;
            } while (await playerRepo.findByKoordinaten(koordinateX, koordinateY, client));

            const newUser = await playerRepo.create(
                username,
                email,
                hashedPassword,
                koordinateX,
                koordinateY,
                client
            );

            // Startressourcen: Geld 100, Stein 500, Eisen 300, Treibstoff 0
            await resourcesRepo.initForUser(newUser.id, client);

            // Rathaus als Startgebäude sofort einbuchen
            const rathaus = await buildingRepo.findTypeByName('Rathaus', client);
            if (rathaus) {
                await buildingRepo.upsertBuilding(newUser.id, rathaus.id, 1, client);
            }

            await client.query('COMMIT');

            const token = signAuthToken(newUser);
            const refreshToken = await issueRefreshToken(newUser.id, client);

            res.status(201).json({
                message: 'User registered successfully',
                token,
                refresh_token: refreshToken,
                user: newUser,
            });
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    })
);

// Login eines bestehenden Benutzers
router.post(
    '/login',
    authLimiter,
    validateBody(loginSchema),
    asyncWrapper(async (req, res) => {
        const { username, password } = req.body;

        const user = await playerRepo.findByUsername(username);
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Account-Sperre prüfen
        if (user.locked_until && new Date(user.locked_until) > new Date()) {
            const remainingMs = new Date(user.locked_until) - new Date();
            const remainingMin = Math.ceil(remainingMs / 60000);
            return res.status(423).json({
                message: `Account ist gesperrt. Bitte versuche es in ${remainingMin} Minute(n) erneut.`,
            });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password_hash);
        if (!isPasswordValid) {
            await playerRepo.incrementFailedLogin(user.id);
            const newCount = user.failed_login_attempts + 1;
            if (newCount >= config.security.maxFailedLogins) {
                const lockedUntil = new Date(Date.now() + config.security.lockoutDurationMs);
                await playerRepo.lockAccount(user.id, lockedUntil);
            }
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        if (!user.is_active) {
            return res.status(403).json({ message: 'User account is inactive' });
        }

        await playerRepo.resetFailedLogin(user.id);
        await playerRepo.updateLastLogin(user.id);

        const refreshToken = await withTransaction(async (client) => {
            return issueRefreshToken(user.id, client);
        });

        const token = signAuthToken(user);

        res.status(200).json({
            message: 'Login successful',
            token,
            refresh_token: refreshToken,
            user: { id: user.id, username: user.username, email: user.email, role: user.role },
        });
    })
);

router.post(
    '/refresh',
    authLimiter,
    validateBody(refreshSchema),
    asyncWrapper(async (req, res) => {
        const { refresh_token } = req.body;
        const refreshTokenHash = hashRefreshToken(refresh_token);

        const tokenPair = await withTransaction(async (client) => {
            const storedToken = await refreshTokenRepo.findActiveByHashForUpdate(
                refreshTokenHash,
                client
            );

            if (!storedToken) {
                return null;
            }

            const user = await playerRepo.findById(storedToken.user_id, client);
            if (!user || !user.is_active) {
                return { inactive: true };
            }

            const newRefreshToken = generateRefreshTokenValue();
            const newRefreshTokenHash = hashRefreshToken(newRefreshToken);
            const expiresAt = new Date(Date.now() + JWT_REFRESH_EXPIRES_IN_MS);

            await refreshTokenRepo.createRefreshToken(user.id, newRefreshTokenHash, expiresAt, client);
            await refreshTokenRepo.revokeAndReplace(refreshTokenHash, newRefreshTokenHash, client);

            return {
                token: signAuthToken(user),
                refresh_token: newRefreshToken,
            };
        });

        if (!tokenPair) {
            return res.status(401).json({ message: 'Invalid or expired refresh token' });
        }

        if (tokenPair.inactive) {
            return res.status(403).json({ message: 'User account is inactive' });
        }

        res.status(200).json({
            message: 'Token refreshed successfully',
            token: tokenPair.token,
            refresh_token: tokenPair.refresh_token,
        });
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
