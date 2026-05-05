import { initShell, getAuth } from '/scripts/shell.js';
import { API_BASE_URL } from '/scripts/config.js';

const auth = getAuth();
if (!auth) throw new Error('Nicht eingeloggt');

const outgoingList = document.getElementById('outgoing-list');
const incomingList = document.getElementById('incoming-list');
const reportsList = document.getElementById('reports-list');

const missionCountdowns = new Map();

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

async function apiGet(path) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${auth.token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || 'Abruf fehlgeschlagen');
  }
  return data;
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

function missionStatusLabel(mission) {
  return mission.status === 'traveling_back' ? 'Rueckreise' : 'Anreise';
}

function missionTimeField(mission) {
  return mission.status === 'traveling_back' ? mission.return_time : mission.arrival_time;
}

async function loadMissions() {
  clearCountdownMap();

  try {
    const [outgoingRes, incomingRes] = await Promise.all([
      apiGet('/combat/missions'),
      apiGet('/combat/incoming'),
    ]);

    const outgoing = outgoingRes.data ?? [];
    const incoming = incomingRes.data ?? [];

    if (!outgoing.length) {
      outgoingList.innerHTML = '<div class="spy-empty">Keine laufenden Angriffe.</div>';
    } else {
      outgoingList.innerHTML = '';
      for (const m of outgoing) {
        const card = document.createElement('div');
        card.className = 'spy-card';
        const time = missionTimeField(m);
        const counterId = `out-${m.id}`;
        card.innerHTML = `
          <div class="spy-card-header">
            <span class="spy-card-icon">${m.status === 'traveling_back' ? '🏠' : '⚔'}</span>
            <strong>Ziel: ${m.defender_username}</strong>
            <span class="spy-card-status ${m.status === 'traveling_back' ? 'returning' : 'traveling'}">${missionStatusLabel(m)}</span>
          </div>
          <div class="spy-card-body">
            <span>📍 Zielkoordinaten: (${m.target_x}, ${m.target_y})</span>
            <span>📏 Distanz: ${Number(m.distance).toFixed(1)} Felder</span>
            <span>⏱ Restzeit: <strong data-countdown-id="${counterId}"></strong></span>
          </div>
        `;
        outgoingList.appendChild(card);
        const node = card.querySelector(`[data-countdown-id="${counterId}"]`);
        if (node && time) addCountdownNode(node, time);
      }
    }

    if (!incoming.length) {
      incomingList.innerHTML = '<div class="spy-empty">Keine eingehenden Angriffe.</div>';
    } else {
      incomingList.innerHTML = '';
      for (const m of incoming) {
        const counterId = `in-${m.id}`;
        const card = document.createElement('div');
        card.className = 'spy-card';
        card.innerHTML = `
          <div class="spy-card-header">
            <span class="spy-card-icon">🚨</span>
            <strong>Angreifer: ${m.attacker_username}</strong>
            <span class="spy-card-status traveling">Anreise</span>
          </div>
          <div class="spy-card-body">
            <span>📍 Ursprung: (${m.origin_x}, ${m.origin_y})</span>
            <span>📏 Distanz: ${Number(m.distance).toFixed(1)} Felder</span>
            <span>⏱ Ankunft in: <strong data-countdown-id="${counterId}"></strong></span>
          </div>
        `;
        incomingList.appendChild(card);
        const node = card.querySelector(`[data-countdown-id="${counterId}"]`);
        if (node) addCountdownNode(node, m.arrival_time);
      }
    }

    tickCountdowns();
  } catch (err) {
    const html = `<div class="spy-error">${err.message}</div>`;
    outgoingList.innerHTML = html;
    incomingList.innerHTML = html;
  }
}

function parseResult(result) {
  if (!result) return null;
  if (typeof result === 'string') {
    try {
      return JSON.parse(result);
    } catch {
      return null;
    }
  }
  return result;
}

function renderLossList(items, keyLabel, keyValue) {
  if (!items?.length) return '<li>Keine Daten</li>';
  return items
    .map((it) => `<li>${it[keyLabel]}: ${it[keyValue]}</li>`)
    .join('');
}

async function loadReports() {
  try {
    const res = await apiGet('/combat/history');
    const history = res.data ?? [];

    if (!history.length) {
      reportsList.innerHTML = '<div class="spy-empty">Noch keine Kampfberichte vorhanden.</div>';
      return;
    }

    reportsList.innerHTML = '';

    for (const m of history) {
      const result = parseResult(m.result);
      const card = document.createElement('div');
      card.className = 'spy-card';

      const isAttacker = Number(m.attacker_id) === Number(auth.user.id);
      const opponent = isAttacker ? m.defender_username : m.attacker_username;
      const reportAt = m.arrival_time ? new Date(m.arrival_time).toLocaleString('de-DE') : '-';

      let contentHtml = '<p>Kein Ergebnis gespeichert.</p>';
      if (result) {
        const won = Boolean(result.attackerWon);
        const myWin = isAttacker ? won : !won;
        const myRate = isAttacker ? result.attackerCasualtyRate : result.defenderCasualtyRate;
        const enemyRate = isAttacker ? result.defenderCasualtyRate : result.attackerCasualtyRate;

        contentHtml = `
          <p><strong>Ausgang:</strong> ${myWin ? 'Sieg' : 'Niederlage'}</p>
          <p><strong>Eigene Verlustrate:</strong> ${Math.round((Number(myRate) || 0) * 100)}%</p>
          <p><strong>Gegnerische Verlustrate:</strong> ${Math.round((Number(enemyRate) || 0) * 100)}%</p>
          <details>
            <summary><strong>Einheitenverluste im Detail</strong></summary>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:8px;">
              <div>
                <div><strong>Angreifer</strong></div>
                <ul>
                  ${renderLossList(result.attackerUnits, 'unitName', 'survived')}
                </ul>
              </div>
              <div>
                <div><strong>Verteidiger</strong></div>
                <ul>
                  ${renderLossList(result.defenderUnits, 'unitName', 'losses')}
                </ul>
              </div>
            </div>
          </details>
        `;
      }

      card.innerHTML = `
        <div class="spy-card-header">
          <span class="spy-card-icon">📋</span>
          <strong>${isAttacker ? 'Angriff auf' : 'Verteidigung gegen'}: ${opponent}</strong>
          <span class="spy-card-date">${reportAt}</span>
        </div>
        <div class="spy-card-meta">
          Distanz: ${Number(m.distance).toFixed(1)} Felder
        </div>
        <div class="spy-card-content">${contentHtml}</div>
        <div class="spy-card-meta" style="margin-top:8px;">
          <a href="/pages/kampfbericht.html?missionId=${m.id}">Details anzeigen</a>
        </div>
      `;

      reportsList.appendChild(card);
    }
  } catch (err) {
    reportsList.innerHTML = `<div class="spy-error">${err.message}</div>`;
  }
}

function setupTabs() {
  document.querySelectorAll('.spy-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.spy-tab').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.spy-section').forEach((s) => (s.style.display = 'none'));
      btn.classList.add('active');
      document.getElementById(`tab-${btn.dataset.tab}`).style.display = '';
    });
  });
}

window.addEventListener('combat-result', () => {
  loadMissions();
  loadReports();
});

window.addEventListener('combat-return', () => {
  loadMissions();
  loadReports();
});

window.addEventListener('combat-incoming', () => {
  loadMissions();
  loadReports();
});

setupTabs();
await initShell();
await Promise.all([loadMissions(), loadReports()]);

setInterval(tickCountdowns, 1000);
setInterval(loadMissions, 10000);
setInterval(loadReports, 30000);
