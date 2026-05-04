import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../config.js';
import * as playerRepo from '../repositories/player.repository.js';
import * as resourcesRepo from '../repositories/resources.repository.js';
import * as buildingRepo from '../repositories/building.repository.js';
import * as refreshTokenRepo from '../repositories/refresh-token.repository.js';
import { withTransaction } from '../repositories/transaction.repository.js';
import { createServiceError } from './service-error.js';

const JWT_SECRET = config.jwt.secret;
const JWT_EXPIRES_IN = config.jwt.expiresIn;
const JWT_REFRESH_EXPIRES_IN_MS = config.jwt.refreshExpiresInMs;

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

export async function registerUser({ username, email, password }) {
    const existing = await playerRepo.findByUsernameOrEmail(username, email);
    if (existing) {
        throw createServiceError('Username or email already exists', 400, 'AUTH_DUPLICATE_USER');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    return withTransaction(async (client) => {
        let koordinateX;
        let koordinateY;
        let versuche = 0;
        const maxVersuche = 50;

        do {
            if (versuche >= maxVersuche) {
                throw createServiceError(
                    'Kein freier Koordinatenplatz verfügbar',
                    503,
                    'MAP_NO_FREE_SLOT'
                );
            }

            koordinateX = Math.floor(Math.random() * config.map.gridSize) + 1;
            koordinateY = Math.floor(Math.random() * config.map.gridSize) + 1;
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

        await resourcesRepo.initForUser(newUser.id, client);

        const rathaus = await buildingRepo.findTypeByName('Rathaus', client);
        if (rathaus) {
            await buildingRepo.upsertBuilding(newUser.id, rathaus.id, 1, client);
        }

        const token = signAuthToken(newUser);
        const refreshToken = await issueRefreshToken(newUser.id, client);

        return {
            message: 'User registered successfully',
            token,
            refresh_token: refreshToken,
            user: newUser,
        };
    });
}

export async function loginUser({ username, password }) {
    const user = await playerRepo.findByUsername(username);
    if (!user) {
        throw createServiceError('Invalid credentials', 401, 'AUTH_INVALID_CREDENTIALS');
    }

    if (user.locked_until && new Date(user.locked_until) > new Date()) {
        const remainingMs = new Date(user.locked_until) - new Date();
        const remainingMin = Math.ceil(remainingMs / 60000);
        throw createServiceError(
            `Account ist gesperrt. Bitte versuche es in ${remainingMin} Minute(n) erneut.`,
            423,
            'AUTH_ACCOUNT_LOCKED'
        );
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
        await playerRepo.incrementFailedLogin(user.id);
        const newCount = user.failed_login_attempts + 1;
        if (newCount >= config.security.maxFailedLogins) {
            const lockedUntil = new Date(Date.now() + config.security.lockoutDurationMs);
            await playerRepo.lockAccount(user.id, lockedUntil);
        }
        throw createServiceError('Invalid credentials', 401, 'AUTH_INVALID_CREDENTIALS');
    }

    if (!user.is_active) {
        throw createServiceError('User account is inactive', 403, 'AUTH_ACCOUNT_INACTIVE');
    }

    const refreshToken = await withTransaction(async (client) => {
        await playerRepo.resetFailedLogin(user.id, client);
        await playerRepo.updateLastLogin(user.id, client);
        return issueRefreshToken(user.id, client);
    });

    const token = signAuthToken(user);

    return {
        message: 'Login successful',
        token,
        refresh_token: refreshToken,
        user: { id: user.id, username: user.username, email: user.email, role: user.role },
    };
}

export async function refreshAuthToken({ refreshToken }) {
    const refreshTokenHash = hashRefreshToken(refreshToken);

    const tokenPair = await withTransaction(async (client) => {
        const storedToken = await refreshTokenRepo.findActiveByHashForUpdate(refreshTokenHash, client);

        if (!storedToken) {
            throw createServiceError(
                'Invalid or expired refresh token',
                401,
                'AUTH_INVALID_REFRESH'
            );
        }

        const user = await playerRepo.findById(storedToken.user_id, client);
        if (!user || !user.is_active) {
            throw createServiceError('User account is inactive', 403, 'AUTH_ACCOUNT_INACTIVE');
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

    return {
        message: 'Token refreshed successfully',
        token: tokenPair.token,
        refresh_token: tokenPair.refresh_token,
    };
}
