// Lazy import to avoid circular dependency (me.service → live-updates.service)
let _meService = null;
async function getMeService() {
    if (!_meService) _meService = await import('./me.service.js');
    return _meService;
}

const sseClientsByUser = new Map();

function writeSseEvent(response, event, data) {
    response.write(`event: ${event}\n`);
    response.write(`data: ${JSON.stringify(data)}\n\n`);
}

function getUserClients(userId) {
    const key = String(userId);
    if (!sseClientsByUser.has(key)) {
        sseClientsByUser.set(key, new Set());
    }
    return sseClientsByUser.get(key);
}

export function openUserStream(userId, response) {
    response.setHeader('Content-Type', 'text/event-stream');
    response.setHeader('Cache-Control', 'no-cache, no-transform');
    response.setHeader('Connection', 'keep-alive');
    response.setHeader('X-Accel-Buffering', 'no');
    response.flushHeaders?.();

    const clients = getUserClients(userId);
    clients.add(response);

    writeSseEvent(response, 'connected', {
        ok: true,
        userId: String(userId),
        connectedAt: new Date().toISOString(),
    });

    return () => {
        const userClients = getUserClients(userId);
        userClients.delete(response);
        if (userClients.size === 0) {
            sseClientsByUser.delete(String(userId));
        }
    };
}

export function broadcastUserStatusUpdate(userId, status) {
    const clients = sseClientsByUser.get(String(userId));
    if (!clients || clients.size === 0) return;

    const payload = {
        status,
        serverTime: new Date().toISOString(),
    };

    for (const response of clients) {
        writeSseEvent(response, 'status', payload);
    }
}

/**
 * Sendet ein beliebiges SSE-Event an einen bestimmten Spieler.
 * Wird vom Combat-Service für Kampf-Benachrichtigungen verwendet.
 */
export function broadcastToUser(userId, event, data) {
    const clients = sseClientsByUser.get(String(userId));
    if (!clients || clients.size === 0) return;
    for (const response of clients) {
        writeSseEvent(response, event, data);
    }
}

/**
 * Öffnet einen SSE-Stream für einen Spieler und sendet sofort den Initialstatus.
 * Kapselt Header-Setup, Client-Registrierung und erste Status-Payload in einem Aufruf.
 *
 * @param {number} userId
 * @param {import('express').Response} res
 * @returns {Promise<() => void>} closeStream-Funktion
 */
export async function mountUserStream(userId, res) {
    const closeStream = openUserStream(userId, res);

    try {
        const meService = await getMeService();
        const payload = await meService.getStreamPayload(userId);
        writeSseEvent(res, 'status', payload);
    } catch (err) {
        closeStream();
        throw err;
    }

    return closeStream;
}

setInterval(() => {
    const heartbeat = { at: new Date().toISOString() };
    for (const clients of sseClientsByUser.values()) {
        for (const response of clients) {
            writeSseEvent(response, 'ping', heartbeat);
        }
    }
}, 25_000);
