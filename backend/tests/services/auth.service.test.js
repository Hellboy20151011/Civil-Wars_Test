import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('bcrypt', () => ({
    default: {
        hash: vi.fn(),
        compare: vi.fn(),
    },
}));

vi.mock('jsonwebtoken', () => ({
    default: {
        sign: vi.fn(() => 'signed-token'),
    },
}));

vi.mock('../../repositories/player.repository.js');
vi.mock('../../repositories/resources.repository.js');
vi.mock('../../repositories/building.repository.js');
vi.mock('../../repositories/refresh-token.repository.js');
vi.mock('../../repositories/transaction.repository.js');

import bcrypt from 'bcrypt';
import * as playerRepo from '../../repositories/player.repository.js';
import * as resourcesRepo from '../../repositories/resources.repository.js';
import * as buildingRepo from '../../repositories/building.repository.js';
import * as refreshTokenRepo from '../../repositories/refresh-token.repository.js';
import { withTransaction } from '../../repositories/transaction.repository.js';
import { loginUser, refreshAuthToken, registerUser } from '../../services/auth.service.js';

withTransaction.mockImplementation(async (fn) => fn({}));

beforeEach(() => {
    vi.clearAllMocks();
    withTransaction.mockImplementation(async (fn) => fn({}));
    bcrypt.hash.mockResolvedValue('hashed-password');
    bcrypt.compare.mockResolvedValue(true);
    refreshTokenRepo.createRefreshToken.mockResolvedValue(undefined);
    refreshTokenRepo.revokeAndReplace.mockResolvedValue(undefined);
    resourcesRepo.initForUser.mockResolvedValue(undefined);
    buildingRepo.findTypeByName.mockResolvedValue({ id: 1, name: 'Rathaus' });
    buildingRepo.upsertBuilding.mockResolvedValue(undefined);
});

describe('registerUser', () => {
    it('rejects duplicate username or email', async () => {
        playerRepo.findByUsernameOrEmail.mockResolvedValue({ id: 1 });
        await expect(
            registerUser({ username: 'tester', email: 'test@example.com', password: 'secret123' })
        ).rejects.toMatchObject({ code: 'AUTH_DUPLICATE_USER' });
    });

    it('retries when user creation hits the coordinate unique constraint', async () => {
        playerRepo.findByUsernameOrEmail.mockResolvedValue(null);
        playerRepo.create
            .mockRejectedValueOnce({ code: '23505', constraint: 'users_coordinates_unique' })
            .mockResolvedValueOnce({
                id: 5, email: 'test@example.com', username: 'tester',
                role: 'player', is_active: true, created_at: '2026-05-05T00:00:00.000Z',
            });
        const result = await registerUser({ username: 'tester', email: 'test@example.com', password: 'secret123' });
        expect(playerRepo.create).toHaveBeenCalledTimes(2);
        expect(result).toEqual(expect.objectContaining({ message: 'User registered successfully' }));
    });

    it('fails after the maximum number of coordinate retries', async () => {
        playerRepo.findByUsernameOrEmail.mockResolvedValue(null);
        playerRepo.create.mockRejectedValue({ code: '23505', constraint: 'users_coordinates_unique' });
        await expect(
            registerUser({ username: 'tester', email: 'test@example.com', password: 'secret123' })
        ).rejects.toMatchObject({ code: 'MAP_NO_FREE_SLOT' });
        expect(playerRepo.create).toHaveBeenCalledTimes(50);
    });

    it('rethrows non-coordinate database errors', async () => {
        const dbError = new Error('db down');
        playerRepo.findByUsernameOrEmail.mockResolvedValue(null);
        playerRepo.create.mockRejectedValue(dbError);
        await expect(
            registerUser({ username: 'tester', email: 'test@example.com', password: 'secret123' })
        ).rejects.toBe(dbError);
    });

    it('registers successfully even when Rathaus building type is not found', async () => {
        playerRepo.findByUsernameOrEmail.mockResolvedValue(null);
        playerRepo.create.mockResolvedValue({
            id: 9, email: 'no-rathaus@example.com', username: 'norathaus',
            role: 'player', is_active: true, created_at: '2026-05-05T00:00:00.000Z',
        });
        buildingRepo.findTypeByName.mockResolvedValue(null);
        const result = await registerUser({ username: 'norathaus', email: 'no-rathaus@example.com', password: 'secret123' });
        expect(result.message).toBe('User registered successfully');
        expect(buildingRepo.upsertBuilding).not.toHaveBeenCalled();
    });
});

describe('loginUser', () => {
    it('rejects unknown users', async () => {
        playerRepo.findByUsername.mockResolvedValue(null);
        await expect(loginUser({ username: 'missing', password: 'wrong' })).rejects.toMatchObject({
            code: 'AUTH_INVALID_CREDENTIALS',
        });
    });

    it('rejects locked accounts', async () => {
        playerRepo.findByUsername.mockResolvedValue({
            id: 7, username: 'tester', email: 'test@example.com', password_hash: 'hash',
            role: 'player', is_active: true, failed_login_attempts: 4,
            locked_until: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        });
        await expect(loginUser({ username: 'tester', password: 'wrong' })).rejects.toMatchObject({
            code: 'AUTH_ACCOUNT_LOCKED', status: 423,
        });
    });

    it('locks the account when failed count reaches threshold', async () => {
        playerRepo.findByUsername.mockResolvedValue({
            id: 7, username: 'tester', email: 'test@example.com', password_hash: 'hash',
            role: 'player', is_active: true, failed_login_attempts: 0, locked_until: null,
        });
        bcrypt.compare.mockResolvedValue(false);
        playerRepo.incrementFailedLogin.mockResolvedValue(5);
        playerRepo.lockAccount.mockResolvedValue(undefined);
        await expect(loginUser({ username: 'tester', password: 'wrong' })).rejects.toMatchObject({
            code: 'AUTH_INVALID_CREDENTIALS',
        });
        expect(playerRepo.incrementFailedLogin).toHaveBeenCalledWith(7);
        expect(playerRepo.lockAccount).toHaveBeenCalledWith(7, expect.any(Date));
    });

    it('does not lock the account when failed count is below threshold', async () => {
        playerRepo.findByUsername.mockResolvedValue({
            id: 7, username: 'tester', email: 'test@example.com', password_hash: 'hash',
            role: 'player', is_active: true, failed_login_attempts: 0, locked_until: null,
        });
        bcrypt.compare.mockResolvedValue(false);
        playerRepo.incrementFailedLogin.mockResolvedValue(2);
        await expect(loginUser({ username: 'tester', password: 'wrong' })).rejects.toMatchObject({
            code: 'AUTH_INVALID_CREDENTIALS',
        });
        expect(playerRepo.lockAccount).not.toHaveBeenCalled();
    });

    it('rejects inactive users even with a valid password', async () => {
        playerRepo.findByUsername.mockResolvedValue({
            id: 7, username: 'tester', email: 'test@example.com', password_hash: 'hash',
            role: 'player', is_active: false, failed_login_attempts: 0, locked_until: null,
        });
        bcrypt.compare.mockResolvedValue(true);
        await expect(loginUser({ username: 'tester', password: 'correct' })).rejects.toMatchObject({
            code: 'AUTH_ACCOUNT_INACTIVE',
        });
    });

    it('resets failed login count and returns tokens on success', async () => {
        playerRepo.findByUsername.mockResolvedValue({
            id: 7, username: 'tester', email: 'test@example.com', password_hash: 'hash',
            role: 'player', is_active: true, failed_login_attempts: 2, locked_until: null,
        });
        playerRepo.resetFailedLogin.mockResolvedValue(undefined);
        playerRepo.updateLastLogin.mockResolvedValue(undefined);
        const result = await loginUser({ username: 'tester', password: 'correct' });
        expect(playerRepo.resetFailedLogin).toHaveBeenCalledWith(7, {});
        expect(playerRepo.updateLastLogin).toHaveBeenCalledWith(7, {});
        expect(result).toEqual({
            message: 'Login successful',
            token: 'signed-token',
            refresh_token: expect.any(String),
            user: { id: 7, username: 'tester', email: 'test@example.com', role: 'player' },
        });
    });
});

describe('refreshAuthToken', () => {
    it('rejects invalid or expired refresh tokens', async () => {
        refreshTokenRepo.findActiveByHashForUpdate.mockResolvedValue(null);
        await expect(refreshAuthToken({ refreshToken: 'invalid-token' })).rejects.toMatchObject({
            code: 'AUTH_INVALID_REFRESH',
        });
    });

    it('rejects inactive users during token refresh', async () => {
        refreshTokenRepo.findActiveByHashForUpdate.mockResolvedValue({ user_id: 7 });
        playerRepo.findById.mockResolvedValue({ id: 7, is_active: false });
        await expect(refreshAuthToken({ refreshToken: 'valid-token' })).rejects.toMatchObject({
            code: 'AUTH_ACCOUNT_INACTIVE',
        });
    });

    it('rotates refresh tokens and returns a new auth token', async () => {
        refreshTokenRepo.findActiveByHashForUpdate.mockResolvedValue({ user_id: 7 });
        playerRepo.findById.mockResolvedValue({
            id: 7, username: 'tester', email: 'test@example.com', role: 'player', is_active: true,
        });
        const result = await refreshAuthToken({ refreshToken: 'valid-token' });
        expect(refreshTokenRepo.createRefreshToken).toHaveBeenCalledTimes(1);
        expect(refreshTokenRepo.revokeAndReplace).toHaveBeenCalledTimes(1);
        expect(result).toEqual({
            message: 'Token refreshed successfully',
            token: 'signed-token',
            refresh_token: expect.any(String),
        });
    });
});
