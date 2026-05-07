import { initShell, getAuth, refreshShellStatus } from '/scripts/shell.js';
import { escapeHtml } from '/scripts/utils/escape.js';
import { createApiClient } from '/scripts/api/client.js';

const auth = getAuth();
if (!auth) throw new Error('Nicht eingeloggt');

const { apiGet, apiPost } = createApiClient(auth);

const container = document.getElementById('spionage-planung');

function renderErrorCard(message) {
    return `<div class="spy-error">${escapeHtml(message)}</div>`;
}

function getTargetId() {
    const id = Number(new URLSearchParams(window.location.search).get('target_id'));
    return Number.isFinite(id) && id > 0 ? id : null;
}

function renderNoTarget() {
    container.innerHTML = `
        <div class="spy-card">
            <div class="spy-card-content">
                Kein Ziel ausgewaehlt. Bitte starte die Planung ueber die <a href="/pages/karte.html">Karte</a>.
            </div>
        </div>
    `;
}

function distance(a, b) {
    return Math.sqrt(Math.pow(a.koordinate_x - b.koordinate_x, 2) + Math.pow(a.koordinate_y - b.koordinate_y, 2));
}

async function initPlanning() {
    const targetId = getTargetId();
    if (!targetId) {
        renderNoTarget();
        return;
    }

    const [playersRes, unitsRes, meRes] = await Promise.all([
        apiGet('/map/players'),
        apiGet('/units/me'),
        apiGet('/me'),
    ]);

    const players = playersRes.players ?? [];
    const own = players.find((p) => Number(p.id) === Number(auth.user.id));
    const target = players.find((p) => Number(p.id) === Number(targetId));
    if (!target || !own) throw new Error('Ziel konnte nicht geladen werden.');

    const intelUnits = (Array.isArray(unitsRes) ? unitsRes : []).filter(
        (u) => u.category === 'intel' && u.quantity > 0 && !u.is_moving
    );
    let availableFuel = Number(meRes?.resources?.treibstoff ?? 0);

    const dist = distance(own, target);

    if (!intelUnits.length) {
        container.innerHTML = `
            <div class="spy-card">
                <div class="spy-card-header"><span class="spy-card-icon">🕵️</span><strong>Spionage: ${escapeHtml(target.username)}</strong></div>
                <div class="spy-card-content">Keine verfuegbaren Geheimdiensteinheiten.</div>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="spy-card">
            <div class="spy-card-header"><span class="spy-card-icon">🕵️</span><strong>Spionage: ${escapeHtml(target.username)}</strong></div>
            <div id="spy-preview-info" class="spy-card-body">
                <span>📍 Ziel: (${escapeHtml(target.koordinate_x)}, ${escapeHtml(target.koordinate_y)})</span>
                <span>📏 Distanz: ${escapeHtml(dist.toFixed(1))} Felder</span>
            </div>
            <div id="spy-units-list"></div>
            <div class="spy-card-content">
                <button id="btn-launch-spy" class="primary-action" disabled>Spione entsenden</button>
                <span id="spy-fuel-badge" class="spy-fuel-badge" style="display:none">Nicht genug Treibstoff</span>
                <span id="spy-msg" class="build-cost" style="margin-left:10px"></span>
            </div>
        </div>
    `;

    const list = document.getElementById('spy-units-list');
    const launchBtn = document.getElementById('btn-launch-spy');
    const fuelBadgeNode = document.getElementById('spy-fuel-badge');
    const msgNode = document.getElementById('spy-msg');
    const previewNode = document.getElementById('spy-preview-info');

    const setLaunchState = (canLaunch, fuelCost = 0) => {
        const hasSelection = fuelCost > 0;
        launchBtn.disabled = !canLaunch;
        if (!hasSelection) {
            fuelBadgeNode.style.display = 'none';
            msgNode.textContent = '';
            return;
        }
        if (!canLaunch) {
            fuelBadgeNode.style.display = 'inline-flex';
            msgNode.style.color = '#f87171';
            msgNode.textContent = `Zu wenig Treibstoff: ${Number(fuelCost).toLocaleString('de-DE')} L benötigt, ${Number(availableFuel).toLocaleString('de-DE')} L verfügbar.`;
        } else {
            fuelBadgeNode.style.display = 'none';
            msgNode.style.color = '#94a3b8';
            msgNode.textContent = '';
        }
    };

    for (const u of intelUnits) {
        const row = document.createElement('div');
        row.className = 'attack-unit-row';
        row.innerHTML = `
            <span class="attack-unit-name">${escapeHtml(u.name)}</span>
            <span class="attack-unit-avail">/${escapeHtml(u.quantity)}</span>
            <input class="attack-unit-qty" type="number" min="0" max="${escapeHtml(u.quantity)}" value="0" data-unit-id="${escapeHtml(u.id)}" />
        `;
        list.appendChild(row);
    }

    const updatePreview = async () => {
        const selectedInputs = [...list.querySelectorAll('.attack-unit-qty')].filter((inp) => Number(inp.value) > 0);
        if (!selectedInputs.length) {
            setLaunchState(false, 0);
            return;
        }

        const ids = selectedInputs.map((inp) => inp.dataset.unitId).join(',');
        const quantities = selectedInputs.map((inp) => Math.floor(Number(inp.value))).join(',');
        try {
            const preview = await apiGet(`/espionage/preview?target_id=${target.id}&unit_ids=${ids}&quantities=${quantities}`);
            const p = preview.data;
            previewNode.innerHTML = `
                <span>📍 Ziel: ${escapeHtml(p.targetUsername)} (${escapeHtml(p.targetCoords.x)}, ${escapeHtml(p.targetCoords.y)})</span>
                <span>📏 Distanz: ${escapeHtml(p.distance)} Felder</span>
                <span>⏱ Reisezeit: ~${escapeHtml(p.travelMinutes)} min</span>
                <span>🛢️ Treibstoff: ${escapeHtml(Number(p.fuelCost).toLocaleString('de-DE'))} L</span>
                <span>🧪 Verfügbar: ${escapeHtml(Number(availableFuel).toLocaleString('de-DE'))} L</span>
                <span>Hinweis: Treibstoff wird beim Absenden abgezogen.</span>
            `;
            setLaunchState(Number(p.fuelCost) <= availableFuel, Number(p.fuelCost));
        } catch {
            // Preview nicht kritisch.
        }
    };

    list.addEventListener('input', updatePreview);

    launchBtn.addEventListener('click', async () => {
        const payloadUnits = [...list.querySelectorAll('.attack-unit-qty')]
            .map((inp) => ({ user_unit_id: Number(inp.dataset.unitId), quantity: Number(inp.value) }))
            .filter((entry) => entry.quantity > 0);

        if (!payloadUnits.length) return;

        if (launchBtn.disabled) return;

        launchBtn.disabled = true;
        msgNode.textContent = 'Starte Spionage...';

        try {
            const data = await apiPost('/espionage/launch', { target_id: Number(target.id), units: payloadUnits });
            availableFuel = Math.max(0, availableFuel - Number(data?.data?.fuelCost ?? 0));
            await refreshShellStatus(auth.token);
            await updatePreview();
            const eta = new Date(data?.data?.arrivalTime);
            const mins = Math.round((eta - Date.now()) / 60000);
            msgNode.textContent = `Spionage gestartet. Ankunft in ~${mins} min.`;
            msgNode.style.color = '#22c55e';
        } catch (err) {
            msgNode.textContent = err.message;
            msgNode.style.color = '#f87171';
            launchBtn.disabled = false;
        }
    });
}

await initShell();
try {
    await initPlanning();
} catch (err) {
    container.innerHTML = renderErrorCard(err.message);
}
