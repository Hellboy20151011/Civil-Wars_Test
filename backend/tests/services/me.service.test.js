import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../services/economy.service.js');
vi.mock('../../repositories/transaction.repository.js');

import * as economyService from '../../services/economy.service.js';
import { withTransaction } from '../../repositories/transaction.repository.js';
import { getPlayerStatus, getStreamPayload } from '../../services/me.service.js';

withTransaction.mockImplementation(async (fn) => fn({}));

beforeEach(() => {
    vi.clearAllMocks();
    withTransaction.mockImplementation(async (fn) => fn({}));
});

describe('getPlayerStatus', () => {
    it('processes production and queue before reading player status', async () => {
        economyService.applyProductionTicks.mockResolvedValue(2);
        economyService.processFinishedQueue.mockResolvedValue(undefined);
        economyService.getSpielerStatus.mockResolvedValue({ resources: { geld: 100 } });

        const result = await getPlayerStatus(9);

        expect(economyService.applyProductionTicks).toHaveBeenCalledWith(9, {});
        expect(economyService.processFinishedQueue).toHaveBeenCalledWith(9, {});
        expect(economyService.getSpielerStatus).toHaveBeenCalledWith(9, {});
        expect(result).toEqual({ resources: { geld: 100 } });
    });
});

describe('getStreamPayload', () => {
    it('wraps the player status with a server timestamp', async () => {
        economyService.applyProductionTicks.mockResolvedValue(1);
        economyService.processFinishedQueue.mockResolvedValue(undefined);
        economyService.getSpielerStatus.mockResolvedValue({ buildings: [] });

        const result = await getStreamPayload(4);

        expect(result).toEqual({
            status: { buildings: [] },
            serverTime: expect.any(String),
        });
    });
});
