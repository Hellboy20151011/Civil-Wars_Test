/**
 * Gemeinsamer API-Client für alle Spielseiten.
 * Erwartet ein Auth-Objekt mit einem `token`-Feld (Rückgabewert von getAuth()).
 *
 * @param {{ token: string }} auth
 * @returns {{ apiFetch: Function, apiGet: Function, apiPost: Function }}
 */
import { API_BASE_URL } from '/scripts/config.js';

export function createApiClient(auth) {
    /**
     * Generischer Fetch-Wrapper – sendet JSON, liest JSON zurück.
     * `options` wird vollständig weitergereicht (z. B. method, cache, body, …).
     */
    async function apiFetch(path, options = {}) {
        const res = await fetch(`${API_BASE_URL}${path}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${auth.token}`,
                ...options.headers,
            },
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw Object.assign(new Error(data.message || 'Fehler'), { status: res.status });
        return data;
    }

    /** Kurzform für GET-Requests ohne Body. */
    async function apiGet(path) {
        const res = await fetch(`${API_BASE_URL}${path}`, {
            headers: { Authorization: `Bearer ${auth.token}` },
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw Object.assign(new Error(data.message || 'Abruf fehlgeschlagen'), { status: res.status });
        return data;
    }

    /** Kurzform für POST-Requests mit JSON-Body. */
    async function apiPost(path, body) {
        const res = await fetch(`${API_BASE_URL}${path}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${auth.token}`,
            },
            body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw Object.assign(new Error(data.message || 'Aktion fehlgeschlagen'), { status: res.status });
        return data;
    }

    return { apiFetch, apiGet, apiPost };
}
