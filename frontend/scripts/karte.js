import { initShell, getAuth } from '/scripts/shell.js';
import { API_BASE_URL } from '/scripts/config.js';
import { escapeHtml } from '/scripts/utils/escape.js';

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
let playersFetchTimer = null;
let playersRequestController = null;
let mapReady = false;
let maxViewportArea = 120000;

const canvas = document.getElementById('map-canvas');
const ctx = canvas.getContext('2d');
const tooltip = document.getElementById('map-tooltip');
const info = document.getElementById('map-info');
const container = document.getElementById('map-container');

function renderActionInfoHtml(target, distance) {
    return `
        <strong>Spieler:</strong> ${escapeHtml(target.username)}<br>
        <strong>Position:</strong> (${escapeHtml(target.koordinate_x)}, ${escapeHtml(target.koordinate_y)})<br>
        <strong>Distanz:</strong> ${escapeHtml(distance)} Felder
    `;
}


// ── Canvas-Größe anpassen ──────────────────────────────────────────────────────
function resizeCanvas() {
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    draw();
    if (mapReady) schedulePlayersReload();
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
    const cfgRes = await fetch(`${API_BASE_URL}/map/config`, {
        headers: { Authorization: `Bearer ${auth.token}` },
    });

    if (!cfgRes.ok) {
        info.textContent = 'Karte konnte nicht geladen werden.';
        return;
    }

    const cfg = await cfgRes.json();

    gridSize = cfg.grid_size ?? 999;
    maxViewportArea = Number(cfg.max_viewport_area) || 120000;

    // Initiales Skalierung: Gesamtes Gitter auf die kürzere Seite der Canvas passen
    const W = canvas.width;
    const H = canvas.height;
    scale = Math.min(W, H) / gridSize;
    // Zentrieren
    offsetX = (W - scale * gridSize) / 2;
    offsetY = (H - scale * gridSize) / 2;
    mapReady = true;
    await loadPlayersInView();
}

function splitBboxIntoRequests(bbox) {
    if (!Number.isFinite(maxViewportArea) || maxViewportArea <= 0) {
        return [bbox];
    }

    const width = bbox.xMax - bbox.xMin + 1;
    const height = bbox.yMax - bbox.yMin + 1;
    if (width * height <= maxViewportArea) {
        return [bbox];
    }

    const maxChunkWidth = Math.max(1, Math.floor(Math.sqrt(maxViewportArea)));
    const maxChunkHeight = Math.max(1, Math.floor(maxViewportArea / maxChunkWidth));

    const chunks = [];
    for (let yStart = bbox.yMin; yStart <= bbox.yMax; yStart += maxChunkHeight) {
        const yEnd = Math.min(bbox.yMax, yStart + maxChunkHeight - 1);
        for (let xStart = bbox.xMin; xStart <= bbox.xMax; xStart += maxChunkWidth) {
            const xEnd = Math.min(bbox.xMax, xStart + maxChunkWidth - 1);
            chunks.push({ xMin: xStart, yMin: yStart, xMax: xEnd, yMax: yEnd });
        }
    }

    return chunks;
}

function getViewportBbox() {
    return {
        xMin: Math.max(1, Math.floor((0 - offsetX) / scale + 0.5)),
        yMin: Math.max(1, Math.floor((0 - offsetY) / scale + 0.5)),
        xMax: Math.min(gridSize, Math.ceil((canvas.width - offsetX) / scale + 0.5)),
        yMax: Math.min(gridSize, Math.ceil((canvas.height - offsetY) / scale + 0.5)),
    };
}

function buildPlayersUrlWithBbox(bbox) {
    const { xMin, yMin, xMax, yMax } = bbox;
    const url = new URL(`${API_BASE_URL}/map/players`);
    url.searchParams.set('x_min', String(xMin));
    url.searchParams.set('y_min', String(yMin));
    url.searchParams.set('x_max', String(xMax));
    url.searchParams.set('y_max', String(yMax));
    return url.toString();
}

async function loadPlayersInView() {
    if (!mapReady) return;

    if (playersRequestController) {
        playersRequestController.abort();
    }
    playersRequestController = new AbortController();
    const viewportBbox = getViewportBbox();
    const requestBboxes = splitBboxIntoRequests(viewportBbox);

    try {
        const responses = await Promise.all(
            requestBboxes.map((bbox) =>
                fetch(buildPlayersUrlWithBbox(bbox), {
                    headers: { Authorization: `Bearer ${auth.token}` },
                    signal: playersRequestController.signal,
                })
            )
        );

        if (responses.some((res) => !res.ok)) return;

        const payloads = await Promise.all(responses.map((res) => res.json()));
        const mergedPlayersById = new Map();
        for (const payload of payloads) {
            for (const player of payload.players ?? []) {
                mergedPlayersById.set(player.id, player);
            }
        }

        players = [...mergedPlayersById.values()];
        hoveredPlayer = hoveredPlayer && players.some((p) => p.id === hoveredPlayer.id) ? hoveredPlayer : null;
        if (clickedPlayer && !players.some((p) => p.id === clickedPlayer.id)) {
            closeAllPanels();
        }

        info.textContent = `${players.length} Spieler im sichtbaren Bereich (${gridSize}×${gridSize})`;
        draw();
    } catch (err) {
        if (err?.name !== 'AbortError') {
            console.error('Spieler konnten nicht geladen werden:', err);
        }
    }
}

function schedulePlayersReload(delayMs = 180) {
    if (!mapReady) return;
    if (playersFetchTimer) clearTimeout(playersFetchTimer);
    playersFetchTimer = setTimeout(() => {
        loadPlayersInView();
    }, delayMs);
}

// ── Zoom ───────────────────────────────────────────────────────────────────────
function zoomAt(cx, cy, factor) {
    const newScale = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, scale * factor));
    const ratio = newScale / scale;
    offsetX = cx - ratio * (cx - offsetX);
    offsetY = cy - ratio * (cy - offsetY);
    scale = newScale;
    draw();
    schedulePlayersReload();
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

window.addEventListener('mouseup', () => {
    if (isDragging) {
        isDragging = false;
        schedulePlayersReload();
    }
});

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

    actionInfo.innerHTML = renderActionInfoHtml(target, distance);

    actionPanel.style.display = 'block';
}

// Karte dient als Einstieg: Angriff/Spionage laufen über dedizierte Planungsseiten.

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
    schedulePlayersReload();
});

window.addEventListener('resize', resizeCanvas);

// ── Init ───────────────────────────────────────────────────────────────────────
await initShell();
resizeCanvas();
await loadMap();
