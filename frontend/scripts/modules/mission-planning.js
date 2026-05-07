import { escapeHtml } from '/scripts/utils/escape.js';
import { createApiClient } from '/scripts/api/client.js';

function getTargetId() {
    const id = Number(new URLSearchParams(window.location.search).get('target_id'));
    return Number.isFinite(id) && id > 0 ? id : null;
}

function distance(a, b) {
    return Math.sqrt(Math.pow(a.koordinate_x - b.koordinate_x, 2) + Math.pow(a.koordinate_y - b.koordinate_y, 2));
}

function getConfig(kind) {
    return kind === 'combat'
        ? {
            icon: '⚔',
            titlePrefix: 'Angriff auf',
            emptyText: 'Keine verfuegbaren Kampfeinheiten.',
            buttonText: 'Angriff starten',
        }
        : {
            icon: '🕵️',
            titlePrefix: 'Spionage:',
            emptyText: 'Keine verfuegbaren Geheimdiensteinheiten.',
            buttonText: 'Spione entsenden',
        };
}

export async function initMissionPlanning({ kind, auth, container, onAfterLaunch }) {
    const targetId = getTargetId();
    if (!targetId) {
        container.innerHTML = `
            <div class="spy-card">
                <div class="spy-card-content">
                    Kein Ziel ausgewaehlt. Bitte starte die Planung ueber die <a href="/pages/karte.html">Karte</a>.
                </div>
            </div>
        `;
        return;
    }

    const { apiGet, apiPost } = createApiClient(auth);
    const [playersRes, unitsRes, meRes] = await Promise.all([
        apiGet('/map/players'),
        apiGet('/units/me'),
        apiGet('/me'),
    ]);

    const players = playersRes.players ?? [];
    const own = players.find((p) => Number(p.id) === Number(auth.user.id));
    const target = players.find((p) => Number(p.id) === Number(targetId));
    if (!target || !own) throw new Error('Ziel konnte nicht geladen werden.');

    const unitFilter = kind === 'combat'
        ? (u) => u.quantity > 0 && !u.is_moving && u.category !== 'intel' && u.category !== 'defense'
        : (u) => u.category === 'intel' && u.quantity > 0 && !u.is_moving;

    const units = (Array.isArray(unitsRes) ? unitsRes : []).filter(unitFilter);
    const cfg = getConfig(kind);
    let availableFuel = Number(meRes?.resources?.treibstoff ?? 0);
    const dist = distance(own, target);

    if (!units.length) {
        container.innerHTML = `
            <div class="spy-card">
                <div class="spy-card-header">
                    <span class="spy-card-icon">${cfg.icon}</span>
                    <strong>${cfg.titlePrefix} ${escapeHtml(target.username)}</strong>
                </div>
                <div class="spy-card-content">${cfg.emptyText}</div>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="spy-card">
            <div class="spy-card-header">
                <span class="spy-card-icon">${cfg.icon}</span>
                <strong>${cfg.titlePrefix} ${escapeHtml(target.username)}</strong>
            </div>
            <div class="spy-card-body" data-preview>
                <span>📍 Ziel: (${escapeHtml(target.koordinate_x)}, ${escapeHtml(target.koordinate_y)})</span>
                <span>📏 Distanz: ${escapeHtml(dist.toFixed(1))} Felder</span>
            </div>
            <div data-units-list></div>
            <div class="spy-card-content">
                <button class="primary-action" data-launch disabled>${cfg.buttonText}</button>
                <span class="spy-fuel-badge" data-fuel-badge style="display:none">Nicht genug Treibstoff</span>
                <span class="build-cost" data-message style="margin-left:10px"></span>
            </div>
        </div>
    `;

    const list = container.querySelector('[data-units-list]');
    const launchBtn = container.querySelector('[data-launch]');
    const fuelBadge = container.querySelector('[data-fuel-badge]');
    const msgNode = container.querySelector('[data-message]');
    const previewNode = container.querySelector('[data-preview]');

    for (const u of units) {
        const fuelAttr = kind === 'combat' ? ` data-fuel-cost="${escapeHtml(Number(u.fuel_cost ?? 0))}"` : '';
        const row = document.createElement('div');
        row.className = 'attack-unit-row';
        row.innerHTML = `
            <span class="attack-unit-name">${escapeHtml(u.name)}</span>
            <span class="attack-unit-avail">/${escapeHtml(u.quantity)}</span>
            <input class="attack-unit-qty" type="number" min="0" max="${escapeHtml(u.quantity)}" value="0" data-unit-id="${escapeHtml(u.id)}"${fuelAttr} />
        `;
        list.appendChild(row);
    }

    const getSelectedInputs = () => [...list.querySelectorAll('.attack-unit-qty')].filter((inp) => Number(inp.value) > 0);

    const setLaunchState = (canLaunch, fuelCost = 0) => {
        const hasSelection = fuelCost > 0;
        launchBtn.disabled = !canLaunch;
        if (!hasSelection) {
            fuelBadge.style.display = 'none';
            msgNode.textContent = '';
            return;
        }

        if (!canLaunch) {
            fuelBadge.style.display = 'inline-flex';
            msgNode.style.color = '#f87171';
            msgNode.textContent = `Zu wenig Treibstoff: ${Number(fuelCost).toLocaleString('de-DE')} L benötigt, ${Number(availableFuel).toLocaleString('de-DE')} L verfügbar.`;
        } else {
            fuelBadge.style.display = 'none';
            msgNode.style.color = '#94a3b8';
            if (kind === 'combat') {
                msgNode.textContent = `Treibstoffbedarf: ${Number(fuelCost).toLocaleString('de-DE')} L | Verfügbar: ${Number(availableFuel).toLocaleString('de-DE')} L`;
            } else {
                msgNode.textContent = '';
            }
        }
    };

    const updateCombatState = () => {
        const selected = getSelectedInputs();
        if (!selected.length) {
            setLaunchState(false, 0);
            return;
        }

        const fuelCost = selected.reduce((sum, inp) => {
            const qty = Number(inp.value);
            const fuelPerUnit = Number(inp.dataset.fuelCost ?? 0);
            return sum + Math.ceil((fuelPerUnit * dist * qty) / 10);
        }, 0);

        setLaunchState(fuelCost <= availableFuel, fuelCost);
    };

    const updateSpyPreview = async () => {
        const selected = getSelectedInputs();
        if (!selected.length) {
            setLaunchState(false, 0);
            return;
        }

        const ids = selected.map((inp) => inp.dataset.unitId).join(',');
        const quantities = selected.map((inp) => Math.floor(Number(inp.value))).join(',');
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
            // Vorschau ist optional.
        }
    };

    const onInput = kind === 'combat' ? updateCombatState : updateSpyPreview;
    list.addEventListener('input', onInput);

    launchBtn.addEventListener('click', async () => {
        const payloadUnits = [...list.querySelectorAll('.attack-unit-qty')]
            .map((inp) => ({ user_unit_id: Number(inp.dataset.unitId), quantity: Number(inp.value) }))
            .filter((entry) => entry.quantity > 0);

        if (!payloadUnits.length || launchBtn.disabled) return;

        launchBtn.disabled = true;
        msgNode.textContent = kind === 'combat' ? 'Starte Angriff...' : 'Starte Spionage...';

        try {
            const data = kind === 'combat'
                ? await apiPost('/combat/attack', { defender_id: Number(target.id), units: payloadUnits })
                : await apiPost('/espionage/launch', { target_id: Number(target.id), units: payloadUnits });

            availableFuel = Math.max(0, availableFuel - Number(data?.data?.fuelCost ?? 0));
            await onAfterLaunch?.();

            // Einheiten-Inputs zuruecksetzen - verhindert Folge-Preview auf bereits
            // entsandte (Menge=0) Einheiten, das sonst 400 INSUFFICIENT_UNITS erzeugt.
            list.querySelectorAll('.attack-unit-qty').forEach((inp) => { inp.value = '0'; });

            if (kind === 'combat') updateCombatState();
            else await updateSpyPreview();

            const eta = new Date(data?.data?.arrivalTime);
            const mins = Math.round((eta - Date.now()) / 60000);
            msgNode.textContent = `${kind === 'combat' ? 'Angriff' : 'Spionage'} gestartet. Ankunft in ~${mins} min.`;
            msgNode.style.color = '#22c55e';
        } catch (err) {
            msgNode.textContent = err.message;
            msgNode.style.color = '#f87171';
            launchBtn.disabled = false;
        }
    });
}
