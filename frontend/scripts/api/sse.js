import { API_BASE_URL } from '/scripts/config.js';

export async function openUserStatusStream(token) {
    const ticketRes = await fetch(`${API_BASE_URL}/me/stream-ticket`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!ticketRes.ok) throw new Error('Ticket-Anfrage fehlgeschlagen');

    const ticketData = await ticketRes.json();
    const streamUrl = `${API_BASE_URL}/me/stream?ticket=${encodeURIComponent(ticketData.ticket)}`;
    return new EventSource(streamUrl);
}
