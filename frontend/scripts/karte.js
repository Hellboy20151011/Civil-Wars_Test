import { initShell, getAuth, showToast, refreshShellStatus } from '/scripts/shell.js';
import { API_BASE_URL } from '/scripts/config.js';

const auth = getAuth();
if (!auth) throw new Error('Nicht eingeloggt');

// ── Konfiguration ──────────────────────────────────────────────────────────────
const GRID_COLOR = '#1e293b';
const GRID_MAJOR_COLOR = '#334155';
const BG_COLOR = '#0d1117';
const PLAYER_COLOR = '#3b82f6';
const PLAYER_HOVER_COLOR = '#60a5fa';
const OWN_COLOR = '#f97316';
const OWN_HOVER_COLOR = '#fb923c';
const PLAYER_RADIUS = 4;
const OWN_RADIUS = 6;
const MAJOR_GRID_EVERY = 10; // Alle 10 Zellen eine dickere Linie
const ZOOM_FACTOR = 1.2;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 20;

// ── State ──────────────────────────────────────────────────────────────────────
let players = [];
let gridSize = 999;
let scale = 1;        // Pixel pro Gitterzelle
let offsetX = 0;      // Kamera-Offset in Canvas-Pixeln
let offsetY = 0;
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let hoveredPlayer = null;
let clickedPlayer = null;   // Ziel für den Angriffs-Dialog
let ownId = auth.user?.id ?? null;

const canvas = document.getElementById('map-canvas');
const ctx = canvas.getContext('2d');
const tooltip = document.getElementById('map-tooltip');
const info = document.getElementById('map-info');
const container = document.getElementById('map-container');

// ── Canvas-Größe anpassen ──────────────────────────────────────────────────────
function resizeCanvas() {
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    draw();
}

// ── Koordinaten-Transformation ─────────────────────────────────────────────────
/** Gitterzelle (1-basiert) → Canvas-Pixel (Mittelpunkt der Zelle) */
function gridToCanvas(gx, gy) {
    return {
        x: offsetX + (gx - 0.5) * scale,
        y: offsetY + (gy - 0.5) * scale,
    };
}

// ── Zeichnen ───────────────────────────────────────────────────────────────────
function draw() {
    const W = canvas.width;
    const H = canvas.height;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, W, H);

    drawGrid(W, H);
    drawPlayers();
}

function drawGrid(W, H) {
    const cellsX = Math.ceil(W / scale) + 2;
    const cellsY = Math.ceil(H / scale) + 2;
    const startCol = Math.max(0, Math.floor(-offsetX / scale));
    const startRow = Math.max(0, Math.floor(-offsetY / scale));

    for (let col = startCol; col <= startCol + cellsX && col <= gridSize; col++) {
        const x = offsetX + col * scale;
        const isMajor = col % MAJOR_GRID_EVERY === 0;
        ctx.strokeStyle = isMajor ? GRID_MAJOR_COLOR : GRID_COLOR;
        ctx.lineWidth = isMajor ? 0.8 : 0.4;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
    }

    for (let row = startRow; row <= startRow + cellsY && row <= gridSize; row++) {
        const y = offsetY + row * scale;
        const isMajor = row % MAJOR_GRID_EVERY === 0;
        ctx.strokeStyle = isMajor ? GRID_MAJOR_COLOR : GRID_COLOR;
        ctx.lineWidth = isMajor ? 0.8 : 0.4;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
    }
}

function drawPlayers() {
    for (const p of players) {
        const isOwn = p.id === ownId;
        const isHovered = hoveredPlayer?.id === p.id;
        const { x, y } = gridToCanvas(p.koordinate_x, p.koordinate_y);

        // Glow für eigene Position
        if (isOwn) {
            ctx.save();
            ctx.shadowBlur = 12;
            ctx.shadowColor = OWN_COLOR;
            ctx.restore();
        }

        const radius = isOwn ? OWN_RADIUS : PLAYER_RADIUS;
        const baseColor = isOwn ? OWN_COLOR : PLAYER_COLOR;
        const color = isHovered ? (isOwn ? OWN_HOVER_COLOR : PLAYER_HOVER_COLOR) : baseColor;

        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        // Rand
        ctx.strokeStyle = isOwn ? '#fff8' : '#1e40af88';
        ctx.lineWidth = isOwn ? 1.5 : 1;
        ctx.stroke();

        // Label bei ausreichendem Zoom
        if (scale >= 6) {
            ctx.fillStyle = '#e2e8f0';
            ctx.font = `${Math.min(scale * 0.8, 11)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText(p.username, x, y - radius - 2);
        }
    }
}

// ── Tooltip ────────────────────────────────────────────────────────────────────
function showTooltip(p, cx, cy) {
    tooltip.textContent = `${p.username} (${p.koordinate_x}, ${p.koordinate_y})`;
    tooltip.style.left = `${cx + 12}px`;
    tooltip.style.top = `${cy - 8}px`;
    tooltip.style.display = 'block';
}

function hideTooltip() {
    tooltip.style.display = 'none';
}

// ── Daten laden ────────────────────────────────────────────────────────────────
async function loadMap() {
    const [cfgRes, playersRes] = await Promise.all([
        fetch(`${API_BASE_URL}/map/config`, { headers: { Authorization: `Bearer ${auth.token}` } }),
        fetch(`${API_BASE_URL}/map/players`, { headers: { Authorization: `Bearer ${auth.token}` } }),
    ]);

    if (!cfgRes.ok || !playersRes.ok) {
        info.textContent = 'Karte konnte nicht geladen werden.';
        return;
    }

    const cfg = await cfgRes.json();
    const data = await playersRes.json();

    gridSize = cfg.grid_size ?? 999;
    players = data.players ?? [];

    // Initiales Skalierung: Gesamtes Gitter auf die kürzere Seite der Canvas passen
    const W = canvas.width;
    const H = canvas.height;
    scale = Math.min(W, H) / gridSize;
    // Zentrieren
    offsetX = (W - scale * gridSize) / 2;
    offsetY = (H - scale * gridSize) / 2;

    info.textContent = `${players.length} Spieler auf ${gridSize}×${gridSize} Karte`;
    draw();
}

// ── Zoom ───────────────────────────────────────────────────────────────────────
function zoomAt(cx, cy, factor) {
    const newScale = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, scale * factor));
    const ratio = newScale / scale;
    offsetX = cx - ratio * (cx - offsetX);
    offsetY = cy - ratio * (cy - offsetY);
    scale = newScale;
    draw();
}

// ── Event-Handler ──────────────────────────────────────────────────────────────
canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? ZOOM_FACTOR : 1 / ZOOM_FACTOR;
    zoomAt(cx, cy, factor);
}, { passive: false });

canvas.addEventListener('mousedown', (e) => {
    isDragging = true;
    dragStartX = e.clientX - offsetX;
    dragStartY = e.clientY - offsetY;
});

window.addEventListener('mouseup', () => { isDragging = false; });

canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;

    if (isDragging) {
        offsetX = e.clientX - dragStartX;
        offsetY = e.clientY - dragStartY;
        hideTooltip();
        draw();
        return;
    }

    // Hover-Detection
    const hitRadius = Math.max(PLAYER_RADIUS, OWN_RADIUS) + 4;
    const found = players.find((p) => {
        const pos = gridToCanvas(p.koordinate_x, p.koordinate_y);
        return Math.hypot(pos.x - cx, pos.y - cy) <= hitRadius;
    });

    if (found !== hoveredPlayer) {
        hoveredPlayer = found ?? null;
        draw();
    }

    if (hoveredPlayer) {
        showTooltip(hoveredPlayer, cx, cy);
        canvas.style.cursor = 'pointer';
    } else {
        hideTooltip();
        canvas.style.cursor = isDragging ? 'grabbing' : 'grab';
    }
});

canvas.addEventListener('mouseleave', () => {
    hoveredPlayer = null;
    hideTooltip();
    draw();
});

// ── Klick auf Spieler → Aktions-Panel öffnen ──────────────────────────────────
canvas.addEventListener('click', (e) => {
    if (isDragging) return;
    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const hitRadius = Math.max(PLAYER_RADIUS, OWN_RADIUS) + 6;

    const found = players.find((p) => {
        const pos = gridToCanvas(p.koordinate_x, p.koordinate_y);
        return Math.hypot(pos.x - cx, pos.y - cy) <= hitRadius;
    });

    if (found && found.id !== ownId) {
        openActionPanel(found);
    } else {
        closeAllPanels();
    }
});

// ── Panel-Helfer ───────────────────────────────────────────────────────────────
function closeAllPanels() {
    document.getElementById('action-panel').style.display  = 'none';
    document.getElementById('attack-panel').style.display  = 'none';
    document.getElementById('spy-panel').style.display     = 'none';
    clickedPlayer = null;
}

// ── Aktions-Panel ──────────────────────────────────────────────────────────────
const actionPanel      = document.getElementById('action-panel');
const actionTargetName = document.getElementById('action-target-name');
const actionInfo       = document.getElementById('action-info');

document.getElementById('action-panel-close').addEventListener('click', closeAllPanels);
document.getElementById('btn-open-attack').addEventListener('click', () => {
    if (!clickedPlayer) return;
    window.location.href = `/pages/kampf.html?target_id=${encodeURIComponent(clickedPlayer.id)}`;
});
document.getElementById('btn-open-spy').addEventListener('click', () => {
    if (!clickedPlayer) return;
    window.location.href = `/pages/spionage.html?target_id=${encodeURIComponent(clickedPlayer.id)}`;
});

function openActionPanel(target) {
    clickedPlayer = target;
    actionTargetName.textContent = target.username;

    const ownPlayer = players.find((p) => p.id === ownId);
    const distance = ownPlayer
        ? Math.sqrt(
              Math.pow(target.koordinate_x - ownPlayer.koordinate_x, 2) +
              Math.pow(target.koordinate_y - ownPlayer.koordinate_y, 2)
          ).toFixed(1)
        : '?';

    actionInfo.innerHTML = `
        <strong>Spieler:</strong> ${target.username}<br>
        <strong>Position:</strong> (${target.koordinate_x}, ${target.koordinate_y})<br>
        <strong>Distanz:</strong> ${distance} Felder
    `;

    actionPanel.style.display = 'block';
}

// ── Angriffs-Panel ─────────────────────────────────────────────────────────────
const attackPanel      = document.getElementById('attack-panel');
const attackTargetName = document.getElementById('attack-target-name');
const attackInfo       = document.getElementById('attack-info');
const attackUnitsList  = document.getElementById('attack-units-list');
const btnLaunch        = document.getElementById('btn-launch-attack');
const attackPanelMsg   = document.getElementById('attack-panel-msg');

document.getElementById('attack-panel-close').addEventListener('click', closeAllPanels);

async function openAttackPanel(target) {
    clickedPlayer = target;
    attackTargetName.textContent = target.username;
    attackPanel.style.display = 'block';
    attackInfo.innerHTML = 'Einheiten werden geladen…';
    attackUnitsList.innerHTML = '';
    btnLaunch.disabled = true;
    attackPanelMsg.textContent = '';

        // Distanz berechnen
    const ownPlayer = players.find((p) => p.id === ownId);
        const distanceValue = ownPlayer
                ? Math.sqrt(
              Math.pow(target.koordinate_x - ownPlayer.koordinate_x, 2) +
              Math.pow(target.koordinate_y - ownPlayer.koordinate_y, 2)
                    )
        : '?';
        const distance = typeof distanceValue === 'number' ? distanceValue.toFixed(1) : distanceValue;

    attackInfo.innerHTML = `
        <strong>Ziel:</strong> (${target.koordinate_x}, ${target.koordinate_y})<br>
        <strong>Distanz:</strong> ${distance} Felder<br>
        <small>Reisezeit abhängig von der langsamsten Einheit.</small>
    `;

    // Eigene Einheiten + Ressourcen laden
    try {
        const [unitsRes, meRes] = await Promise.all([
            fetch(`${API_BASE_URL}/units/me`, {
                headers: { Authorization: `Bearer ${auth.token}` },
            }),
            fetch(`${API_BASE_URL}/me`, {
                headers: { Authorization: `Bearer ${auth.token}` },
            }),
        ]);
        if (!unitsRes.ok) throw new Error('Einheiten konnten nicht geladen werden');
        if (!meRes.ok) throw new Error('Ressourcen konnten nicht geladen werden');
        const data = await unitsRes.json();
        const meData = await meRes.json();
        let availableFuel = Number(meData?.resources?.treibstoff ?? 0);
        const units = (Array.isArray(data) ? data : (data.units ?? [])).filter(
            (u) => u.quantity > 0 && !u.is_moving && u.category !== 'defense' && u.category !== 'intel'
        );

        if (units.length === 0) {
            attackUnitsList.innerHTML = '<div style="color:#64748b;padding:6px 0">Keine verfügbaren Einheiten.</div>';
            return;
        }

        attackUnitsList.innerHTML = '';
        for (const u of units) {
            const row = document.createElement('div');
            row.className = 'attack-unit-row';
            row.innerHTML = `
                <span class="attack-unit-name">${u.name}</span>
                <span class="attack-unit-avail">/${u.quantity}</span>
                <input
                    class="attack-unit-qty"
                    type="number"
                    min="0"
                    max="${u.quantity}"
                    value="0"
                    data-unit-id="${u.id}"
                    data-fuel-cost="${Number(u.fuel_cost ?? 0)}"
                />
            `;
            attackUnitsList.appendChild(row);
        }

        const fuelBadge = document.getElementById('attack-fuel-badge');

        const calculateAttackFuelCost = () => {
            if (typeof distanceValue !== 'number') return 0;
            return [...attackUnitsList.querySelectorAll('.attack-unit-qty')]
                .filter((inp) => parseInt(inp.value, 10) > 0)
                .reduce((sum, inp) => {
                    const qty = parseInt(inp.value, 10);
                    const fuelPerUnit = Number(inp.dataset.fuelCost ?? 0);
                    return sum + Math.ceil((fuelPerUnit * distanceValue * qty) / 10);
                }, 0);
        };

        const setAttackLaunchState = () => {
            const anySelected = [...attackUnitsList.querySelectorAll('.attack-unit-qty')]
                .some((inp) => parseInt(inp.value, 10) > 0);
            if (!anySelected) {
                btnLaunch.disabled = true;
                if (fuelBadge) fuelBadge.style.display = 'none';
                attackPanelMsg.textContent = '';
                attackInfo.innerHTML = `
                    <strong>Ziel:</strong> (${target.koordinate_x}, ${target.koordinate_y})<br>
                    <strong>Distanz:</strong> ${distance} Felder<br>
                    <small>Reisezeit abhängig von der langsamsten Einheit.</small>
                `;
                return;
            }

            const fuelCost = calculateAttackFuelCost();
            const hasFuel = fuelCost <= availableFuel;
            btnLaunch.disabled = !hasFuel;
            if (fuelBadge) fuelBadge.style.display = hasFuel ? 'none' : 'inline-flex';

            attackInfo.innerHTML = `
                <strong>Ziel:</strong> (${target.koordinate_x}, ${target.koordinate_y})<br>
                <strong>Distanz:</strong> ${distance} Felder<br>
                <strong>Treibstoffbedarf:</strong> ${fuelCost.toLocaleString()} L<br>
                <strong>Verfügbar:</strong> ${availableFuel.toLocaleString()} L<br>
                <small>Reisezeit abhängig von der langsamsten Einheit.</small>
            `;

            if (!hasFuel) {
                attackPanelMsg.style.color = '#f87171';
                attackPanelMsg.textContent = `Zu wenig Treibstoff: ${fuelCost.toLocaleString()} L benötigt, ${availableFuel.toLocaleString()} L verfügbar.`;
            } else if (!attackPanelMsg.textContent || attackPanelMsg.style.color === 'rgb(248, 113, 113)') {
                attackPanelMsg.style.color = '#94a3b8';
                attackPanelMsg.textContent = '';
            }
        };

        attackUnitsList.addEventListener('input', setAttackLaunchState);
    } catch (err) {
        attackUnitsList.innerHTML = `<div style="color:#f87171">${err.message}</div>`;
    }
}

btnLaunch.addEventListener('click', async () => {
    if (!clickedPlayer) return;

    const unitInputs = [...attackUnitsList.querySelectorAll('.attack-unit-qty')];
    const units = unitInputs
        .map((inp) => ({ user_unit_id: parseInt(inp.dataset.unitId, 10), quantity: parseInt(inp.value, 10) }))
        .filter((u) => u.quantity > 0);

    if (units.length === 0) return;
    if (btnLaunch.disabled) return;

    btnLaunch.disabled = true;
    attackPanelMsg.textContent = 'Starte Angriff…';

    try {
        const res = await fetch(`${API_BASE_URL}/combat/attack`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${auth.token}`,
            },
            body: JSON.stringify({ defender_id: clickedPlayer.id, units }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message ?? 'Fehler beim Starten des Angriffs');

        await refreshShellStatus(auth.token);

        const eta = new Date(data.data.arrivalTime);
        const mins = Math.round((eta - Date.now()) / 60000);
        attackPanelMsg.style.color = '#22c55e';
        attackPanelMsg.textContent = `✓ Einheiten unterwegs – Ankunft in ~${mins} min`;
        showToast(`⚔️ Angriff auf ${clickedPlayer.username} gestartet! Ankunft in ~${mins} min.`, 'info');

        setTimeout(closeAllPanels, 3000);
    } catch (err) {
        attackPanelMsg.style.color = '#f87171';
        attackPanelMsg.textContent = err.message;
        btnLaunch.disabled = false;
    }
});

// ── Spionage-Panel ─────────────────────────────────────────────────────────────
const spyPanel       = document.getElementById('spy-panel');
const spyTargetName  = document.getElementById('spy-target-name');
const spyPreviewInfo = document.getElementById('spy-preview-info');
const spyUnitsList   = document.getElementById('spy-units-list');
const btnLaunchSpy   = document.getElementById('btn-launch-spy');
const spyPanelMsg    = document.getElementById('spy-panel-msg');

document.getElementById('spy-panel-close').addEventListener('click', closeAllPanels);

async function openSpyPanel(target) {
    clickedPlayer = target;
    spyTargetName.textContent = target.username;
    spyPanel.style.display = 'block';
    spyPreviewInfo.innerHTML = 'Geheimdiensteinheiten werden geladen…';
    spyUnitsList.innerHTML = '';
    btnLaunchSpy.disabled = true;
    spyPanelMsg.textContent = '';

    try {
        const [unitsRes, meRes] = await Promise.all([
            fetch(`${API_BASE_URL}/units/me`, {
                headers: { Authorization: `Bearer ${auth.token}` },
            }),
            fetch(`${API_BASE_URL}/me`, {
                headers: { Authorization: `Bearer ${auth.token}` },
            }),
        ]);
        if (!unitsRes.ok) throw new Error('Einheiten konnten nicht geladen werden');
        if (!meRes.ok) throw new Error('Ressourcen konnten nicht geladen werden');
        const data = await unitsRes.json();
        const meData = await meRes.json();
        let availableFuel = Number(meData?.resources?.treibstoff ?? 0);
        const intelUnits = (Array.isArray(data) ? data : (data.units ?? [])).filter(
            (u) => u.category === 'intel' && u.quantity > 0 && !u.is_moving
        );

        if (intelUnits.length === 0) {
            spyPreviewInfo.innerHTML = `
                <div style="color:#f59e0b;padding:8px 0">
                    Keine Geheimdiensteinheiten verfügbar.<br>
                    <small>Baue ein <strong>Geheimdienstzentrum Level 1</strong> und bilde <strong>Spione</strong> aus.</small>
                </div>`;
            return;
        }

        const ownPlayer = players.find((p) => p.id === ownId);
        const distance = ownPlayer
            ? Math.sqrt(
                  Math.pow(target.koordinate_x - ownPlayer.koordinate_x, 2) +
                  Math.pow(target.koordinate_y - ownPlayer.koordinate_y, 2)
              ).toFixed(1)
            : '?';

        spyPreviewInfo.innerHTML = `
            <strong>Ziel:</strong> ${target.username} (${target.koordinate_x}, ${target.koordinate_y})<br>
            <strong>Distanz:</strong> ${distance} Felder<br>
            <small style="color:#94a3b8">Mehr Spione = höhere Erfolgswahrscheinlichkeit und detailliertere Berichte.</small>
        `;

        spyUnitsList.innerHTML = '';
        for (const u of intelUnits) {
            const row = document.createElement('div');
            row.className = 'attack-unit-row';
            row.innerHTML = `
                <span class="attack-unit-name">${u.name}</span>
                <span class="attack-unit-avail">/${u.quantity}</span>
                <input
                    class="attack-unit-qty"
                    type="number"
                    min="0"
                    max="${u.quantity}"
                    value="0"
                    data-unit-id="${u.id}"
                />
            `;
            spyUnitsList.appendChild(row);
        }

        spyUnitsList.addEventListener('input', updateSpyPreview);

        const setLaunchState = (canLaunch, fuelCost = 0) => {
            const hasSelection = fuelCost > 0;
            btnLaunchSpy.disabled = !canLaunch;
            const fuelBadge = document.getElementById('spy-fuel-badge');
            if (!hasSelection) {
                if (fuelBadge) fuelBadge.style.display = 'none';
                spyPanelMsg.textContent = '';
                return;
            }
            if (!canLaunch) {
                if (fuelBadge) fuelBadge.style.display = 'inline-flex';
                spyPanelMsg.style.color = '#f87171';
                spyPanelMsg.textContent = `Zu wenig Treibstoff: ${Number(fuelCost).toLocaleString('de-DE')} L benötigt, ${Number(availableFuel).toLocaleString('de-DE')} L verfügbar.`;
            } else if (!spyPanelMsg.textContent || spyPanelMsg.style.color === 'rgb(248, 113, 113)') {
                if (fuelBadge) fuelBadge.style.display = 'none';
                spyPanelMsg.style.color = '#94a3b8';
                spyPanelMsg.textContent = '';
            }
        };

        async function updateSpyPreview() {
            const inputs = [...spyUnitsList.querySelectorAll('.attack-unit-qty')];
            const any = inputs.some((inp) => parseInt(inp.value, 10) > 0);

            if (!any) {
                setLaunchState(false, 0);
                return;
            }

            const unitIds = inputs
                .filter((inp) => parseInt(inp.value, 10) > 0)
                .map((inp) => inp.dataset.unitId)
                .join(',');
            const quantities = inputs
                .filter((inp) => parseInt(inp.value, 10) > 0)
                .map((inp) => parseInt(inp.value, 10))
                .join(',');

            try {
                const r = await fetch(
                    `${API_BASE_URL}/espionage/preview?target_id=${target.id}&unit_ids=${unitIds}&quantities=${quantities}`,
                    { headers: { Authorization: `Bearer ${auth.token}` } }
                );
                if (!r.ok) return;
                const d = await r.json();
                const p = d.data;
                spyPreviewInfo.innerHTML = `
                    <strong>Ziel:</strong> ${p.targetUsername} (${p.targetCoords.x}, ${p.targetCoords.y})<br>
                    <strong>Distanz:</strong> ${p.distance} Felder<br>
                    <strong>Reisezeit:</strong> ~${p.travelMinutes} min<br>
                    <strong>Treibstoffbedarf:</strong> ${p.fuelCost.toLocaleString()} L<br>
                    <strong>Verfügbar:</strong> ${availableFuel.toLocaleString()} L<br>
                    <small style="color:#94a3b8">Treibstoff wird beim Absenden sofort abgezogen.</small>
                `;
                setLaunchState(Number(p.fuelCost) <= availableFuel, Number(p.fuelCost));
            } catch {
                // Vorschau nicht kritisch
            }
        }

    } catch (err) {
        spyPreviewInfo.innerHTML = `<div style="color:#f87171">${err.message}</div>`;
    }
}

btnLaunchSpy.addEventListener('click', async () => {
    if (!clickedPlayer) return;

    const unitInputs = [...spyUnitsList.querySelectorAll('.attack-unit-qty')];
    const units = unitInputs
        .map((inp) => ({ user_unit_id: parseInt(inp.dataset.unitId, 10), quantity: parseInt(inp.value, 10) }))
        .filter((u) => u.quantity > 0);

    if (units.length === 0) return;

    if (btnLaunchSpy.disabled) return;

    btnLaunchSpy.disabled = true;
    spyPanelMsg.textContent = 'Spione werden entsandt…';

    try {
        const res = await fetch(`${API_BASE_URL}/espionage/launch`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${auth.token}`,
            },
            body: JSON.stringify({ target_id: Number(clickedPlayer.id), units }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message ?? 'Fehler beim Starten der Spionage');

        await refreshShellStatus(auth.token);

        const eta = new Date(data.data.arrivalTime);
        const mins = Math.round((eta - Date.now()) / 60000);
        spyPanelMsg.style.color = '#22c55e';
        spyPanelMsg.textContent = `✓ Spione unterwegs – Ankunft in ~${mins} min`;
        showToast(`🕵️ Spione zu ${clickedPlayer.username} entsandt! Ankunft in ~${mins} min.`, 'info');

        setTimeout(closeAllPanels, 3000);
    } catch (err) {
        spyPanelMsg.style.color = '#f87171';
        spyPanelMsg.textContent = err.message;
        btnLaunchSpy.disabled = false;
    }
});

document.getElementById('btn-zoom-in').addEventListener('click', () => {
    zoomAt(canvas.width / 2, canvas.height / 2, ZOOM_FACTOR);
});

document.getElementById('btn-zoom-out').addEventListener('click', () => {
    zoomAt(canvas.width / 2, canvas.height / 2, 1 / ZOOM_FACTOR);
});

document.getElementById('btn-reset-view').addEventListener('click', () => {
    const W = canvas.width;
    const H = canvas.height;
    scale = Math.min(W, H) / gridSize;
    offsetX = (W - scale * gridSize) / 2;
    offsetY = (H - scale * gridSize) / 2;
    draw();
});

window.addEventListener('resize', resizeCanvas);

// ── Init ───────────────────────────────────────────────────────────────────────
await initShell();
resizeCanvas();
await loadMap();
