import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../services/me.service.js', () => ({
    getStreamPayload: vi.fn(),
}));

import { getStreamPayload } from '../../services/me.service.js';
import {
    createStreamTicket,
    redeemStreamTicket,
    openUserStream,
    broadcastUserStatusUpdate,
    broadcastToUser,
    mountUserStream,
} from '../../services/live-updates.service.js';

function createMockResponse() {
    const writes = [];
    return {
        writes,
        setHeader: vi.fn(),
        flushHeaders: vi.fn(),
        write: vi.fn((chunk) => writes.push(chunk)),
    };
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe('stream ticket lifecycle', () => {
    it('creates and redeems one-time tickets', () => {
        const ticket = createStreamTicket(123);
        expect(ticket).toMatch(/^[a-f0-9]{64}$/);

        expect(redeemStreamTicket(ticket)).toBe(123);
        expect(redeemStreamTicket(ticket)).toBeNull();
    });
});

describe('SSE stream + broadcast', () => {
    it('opens user stream and broadcasts status/event payloads', () => {
        const res = createMockResponse();
        const close = openUserStream(7, res);

        expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
        expect(res.writes.join('')).toContain('event: connected');

        broadcastUserStatusUpdate(7, { resources: { geld: 10 } });
        broadcastToUser(7, 'combat_result', { attackerWon: true });

        const output = res.writes.join('');
        expect(output).toContain('event: status');
        expect(output).toContain('event: combat_result');

        close();
        const callsBefore = res.write.mock.calls.length;
        broadcastToUser(7, 'after_close', { ok: true });
        expect(res.write.mock.calls.length).toBe(callsBefore);
    });
});

describe('mountUserStream', () => {
    it('sends initial status payload after opening stream', async () => {
        getStreamPayload.mockResolvedValue({ status: { queue: [] }, serverTime: '2026-01-01T00:00:00.000Z' });
        const res = createMockResponse();

        const close = await mountUserStream(55, res);

        const output = res.writes.join('');
        expect(output).toContain('event: connected');
        expect(output).toContain('event: status');
        expect(getStreamPayload).toHaveBeenCalledWith(55);

        close();
    });

    it('closes stream when initial payload lookup fails', async () => {
        getStreamPayload.mockRejectedValue(new Error('stream failed'));
        const res = createMockResponse();

        await expect(mountUserStream(77, res)).rejects.toThrow('stream failed');

        const callsBefore = res.write.mock.calls.length;
        broadcastToUser(77, 'status', { ok: true });
        expect(res.write.mock.calls.length).toBe(callsBefore);
    });
});
