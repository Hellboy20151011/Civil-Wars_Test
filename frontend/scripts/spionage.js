import { initShell, getAuth } from '/scripts/shell.js';
import { API_BASE_URL } from '/scripts/config.js';

const auth = getAuth();
if (!auth) throw new Error('Nicht eingeloggt');

const missionCountdowns = new Map();

// ── Tab-Navigation ─────────────────────────────────────────────────────────────
document.querySelectorAll('.spy-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.spy-tab').forEach((b) => b.classList.remove('active'));
        document.querySelectorAll('.spy-section').forEach((s) => (s.style.display = 'none'));
        btn.classList.add('active');
        document.getElementById(`tab-${btn.dataset.tab}`).style.display = '';
    });
});

function formatTimeLeft(targetDate) {
    const ms = new Date(targetDate) - Date.now();
    if (ms <= 0) return 'Wird verarbeitet...';
    const totalSec = Math.ceil(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
}

function clearCountdownMap() {
    missionCountdowns.clear();
}

function addCountdownNode(node, isoTime) {
    const id = node.dataset.countdownId;
    if (!id) return;
    missionCountdowns.set(id, { node, isoTime });
}

function tickCountdowns() {
    for (const { node, isoTime } of missionCountdowns.values()) {
        node.textContent = formatTimeLeft(isoTime);
    }
}

function missionTimeField(mission) {
    return mission.status === 'traveling_back' ? mission.return_time : mission.arrival_time;
}

// ── Daten laden ────────────────────────────────────────────────────────────────

async function loadMissions() {
    const list = document.getElementById('missions-list');
    clearCountdownMap();
    try {
        const res = await fetch(`${API_BASE_URL}/espionage/missions`, {
            headers: { Authorization: `Bearer ${auth.token}` },
        });
        if (!res.ok) throw new Error('Missionen konnten nicht geladen werden');
        const data = await res.json();
        const missions = data.data ?? [];

        if (missions.length === 0) {
            list.innerHTML = '<div class="spy-empty">Keine laufenden Missionen.</div>';
            return;
        }

        list.innerHTML = '';
        for (const m of missions) {
            const isReturning = m.status === 'traveling_back';
            const targetTime = missionTimeField(m);
            const counterId = `spy-${m.id}`;

            const card = document.createElement('div');
            card.className = 'spy-card';
            card.innerHTML = `
                <div class="spy-card-header">
                    <span class="spy-card-icon">${isReturning ? '🏠' : '🕵️'}</span>
                    <strong>${isReturning ? 'Rückkehr von' : 'Mission zu'}: ${m.target_username}</strong>
                    <span class="spy-card-status ${isReturning ? 'returning' : 'traveling'}">${isReturning ? 'Kehrt zurück' : 'Reist zum Ziel'}</span>
                </div>
                <div class="spy-card-body">
                    <span>📍 Ziel: (${m.target_kx}, ${m.target_ky})</span>
                    <span>👥 Spione: ${m.spies_sent}</span>
                    <span>⏱ ${isReturning ? 'Rueckkunft' : 'Ankunft'}: <strong data-countdown-id="${counterId}"></strong></span>
                </div>
            `;
            list.appendChild(card);
            const node = card.querySelector(`[data-countdown-id="${counterId}"]`);
            if (node && targetTime) addCountdownNode(node, targetTime);
        }

        tickCountdowns();
    } catch (err) {
        list.innerHTML = `<div class="spy-error">${err.message}</div>`;
    }
}

async function loadReports() {
    const list = document.getElementById('reports-list');
    try {
        const res = await fetch(`${API_BASE_URL}/espionage/reports`, {
            headers: { Authorization: `Bearer ${auth.token}` },
        });
        if (!res.ok) throw new Error('Berichte konnten nicht geladen werden');
        const data = await res.json();
        const reports = data.data ?? [];

        if (reports.length === 0) {
            list.innerHTML = '<div class="spy-empty">Noch keine Berichte vorhanden.</div>';
            return;
        }

        list.innerHTML = '';
        for (const r of reports) {
            const card = renderReport(r);
            list.appendChild(card);
        }
    } catch (err) {
        list.innerHTML = `<div class="spy-error">${err.message}</div>`;
    }
}

function renderReport(r) {
    const card = document.createElement('div');
    card.className = 'spy-card';
    const report = r.report ?? {};
    const date = new Date(r.created_at).toLocaleString('de-DE');

    let contentHtml;

    if (!report.success) {
        contentHtml = `<div class="spy-report-fail">
            ❌ Alle Spione wurden erwischt (${report.spiesCaught ?? r.spies_sent} gefangen).<br>
            Keine Informationen gesammelt.
        </div>`;
    } else {
        const detail = report.detail ?? 'low';
        const caughtNote = report.spiesCaught > 0
            ? `<span class="spy-caught">${report.spiesCaught} Spion(e) erwischt</span>`
            : '<span class="spy-safe">Keine Spione erwischt</span>';

        if (detail === 'low') {
            const cats = (report.buildings?.categories ?? []).join(', ');
            contentHtml = `
                <p>${caughtNote}</p>
                <p><strong>Gebäudekategorien erkannt:</strong> ${cats || '–'}</p>
                <p class="spy-hint-small">Mehr Spione für detailliertere Berichte entsenden.</p>
            `;
        } else if (detail === 'medium') {
            const bldgs = Object.entries(report.buildings ?? {})
                .map(([cat, cnt]) => `${cat}: ${cnt}`)
                .join(', ');
            const unitCats = (report.units?.categories ?? []).join(', ');
            contentHtml = `
                <p>${caughtNote}</p>
                <p><strong>Gebäude:</strong> ${bldgs || '–'}</p>
                <p><strong>Einheitenkategorien:</strong> ${unitCats || '–'}</p>
            `;
        } else {
            // Full report
            const bldgs = Object.entries(report.buildings ?? {})
                .map(([cat, cnt]) => `<li>${cat}: ${cnt}</li>`)
                .join('');
            const units = Object.entries(report.units ?? {})
                .filter(([, v]) => v.quantity > 0)
                .map(([name, v]) => `<li>${name} (${v.category}): ${v.quantity}</li>`)
                .join('');
            const defenses = (report.defenses ?? [])
                .map((d) => `<li>${d.name}: ${d.quantity}</li>`)
                .join('');

            contentHtml = `
                <p>${caughtNote}</p>
                <details open>
                    <summary><strong>🏗 Gebäude</strong></summary>
                    <ul>${bldgs || '<li>Keine</li>'}</ul>
                </details>
                <details open>
                    <summary><strong>⚔️ Einheiten</strong></summary>
                    <ul>${units || '<li>Keine</li>'}</ul>
                </details>
                <details open>
                    <summary><strong>🛡 Verteidigungen</strong></summary>
                    <ul>${defenses || '<li>Keine</li>'}</ul>
                </details>
            `;
        }
    }

    card.innerHTML = `
        <div class="spy-card-header">
            <span class="spy-card-icon">${report.success ? '📋' : '❌'}</span>
            <strong>Bericht: ${r.target_username}</strong>
            <span class="spy-card-date">${date}</span>
        </div>
        <div class="spy-card-meta">
            Entsandte Spione: ${r.spies_sent} | Zurückgekehrt: ${r.spies_returned ?? '–'}
        </div>
        <div class="spy-card-content">${contentHtml}</div>
    `;
    return card;
}

// ── SSE-Events für Spionage ────────────────────────────────────────────────────
window.addEventListener('spy-return', () => {
    loadMissions();
    loadReports();
});

window.addEventListener('spy-mission-update', () => {
    loadMissions();
});

// ── Init ───────────────────────────────────────────────────────────────────────
await initShell();
await Promise.all([loadMissions(), loadReports()]);

// Sekundengenaues Countdown-Ticking + zyklischer Sync mit Serverdaten
setInterval(tickCountdowns, 1_000);
setInterval(loadMissions, 10_000);
