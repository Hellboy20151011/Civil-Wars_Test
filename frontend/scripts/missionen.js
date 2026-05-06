import { initShell, getAuth } from '/scripts/shell.js';
import { API_BASE_URL } from '/scripts/config.js';

const auth = getAuth();
if (!auth) throw new Error('Nicht eingeloggt');

const outgoingList = document.getElementById('outgoing-list');
const incomingList = document.getElementById('incoming-list');
const combatReportsList = document.getElementById('combat-reports-list');
const spyMissionsList = document.getElementById('spy-missions-list');
const spyReportsList = document.getElementById('spy-reports-list');

const countdowns = new Map();

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

function clearCountdowns() {
  countdowns.clear();
}

function addCountdownNode(node, isoTime) {
  const id = node.dataset.countdownId;
  if (!id) return;
  countdowns.set(id, { node, isoTime });
}

function tickCountdowns() {
  for (const { node, isoTime } of countdowns.values()) {
    node.textContent = formatTimeLeft(isoTime);
  }
}

async function apiGet(path) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${auth.token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'Abruf fehlgeschlagen');
  return data;
}

function missionStatusLabel(mission) {
  return mission.status === 'traveling_back' ? 'Rueckreise' : 'Anreise';
}

function missionTimeField(mission) {
  return mission.status === 'traveling_back' ? mission.return_time : mission.arrival_time;
}

function renderLossList(items, keyLabel, keyValue) {
  if (!items?.length) return '<li>Keine Daten</li>';
  return items.map((it) => `<li>${it[keyLabel]}: ${it[keyValue]}</li>`).join('');
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

async function loadCombatMissions() {
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

async function loadCombatReports() {
  try {
    const res = await apiGet('/combat/history');
    const history = res.data ?? [];

    if (!history.length) {
      combatReportsList.innerHTML = '<div class="spy-empty">Noch keine Kampfberichte vorhanden.</div>';
      return;
    }

    combatReportsList.innerHTML = '';
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
                <ul>${renderLossList(result.attackerUnits, 'unitName', 'survived')}</ul>
              </div>
              <div>
                <div><strong>Verteidiger</strong></div>
                <ul>${renderLossList(result.defenderUnits, 'unitName', 'losses')}</ul>
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
        <div class="spy-card-meta">Distanz: ${Number(m.distance).toFixed(1)} Felder</div>
        <div class="spy-card-content">${contentHtml}</div>
        <div class="spy-card-meta" style="margin-top:8px;">
          <a href="/pages/kampfbericht.html?missionId=${m.id}">Details anzeigen</a>
        </div>
      `;

      combatReportsList.appendChild(card);
    }
  } catch (err) {
    combatReportsList.innerHTML = `<div class="spy-error">${err.message}</div>`;
  }
}

function missionTimeFieldSpy(mission) {
  return mission.status === 'traveling_back' ? mission.return_time : mission.arrival_time;
}

async function loadSpyMissions() {
  try {
    const res = await apiGet('/espionage/missions');
    const missions = res.data ?? [];

    if (!missions.length) {
      spyMissionsList.innerHTML = '<div class="spy-empty">Keine laufenden Missionen.</div>';
      return;
    }

    spyMissionsList.innerHTML = '';
    for (const m of missions) {
      const isReturning = m.status === 'traveling_back';
      const targetTime = missionTimeFieldSpy(m);
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
      spyMissionsList.appendChild(card);
      const node = card.querySelector(`[data-countdown-id="${counterId}"]`);
      if (node && targetTime) addCountdownNode(node, targetTime);
    }

    tickCountdowns();
  } catch (err) {
    spyMissionsList.innerHTML = `<div class="spy-error">${err.message}</div>`;
  }
}

function renderSpyReport(r) {
  const card = document.createElement('div');
  card.className = 'spy-card';
  const report = r.report ?? {};
  const date = new Date(r.created_at).toLocaleString('de-DE');
  const successRatePercent = Number.isFinite(Number(report.successRatePercent))
    ? Number(report.successRatePercent)
    : 0;

  let contentHtml;
  if (!report.success) {
    contentHtml = `<div class="spy-report-fail">
      ❌ Alle Spione wurden erwischt (${report.spiesCaught ?? r.spies_sent} gefangen).<br>
      Erfolgsquote: <strong>${successRatePercent}%</strong><br>
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
        <p><strong>Erfolgsquote:</strong> ${successRatePercent}%</p>
        <p><strong>Gebäudekategorien erkannt:</strong> ${cats || '–'}</p>
      `;
    } else if (detail === 'medium') {
      const bldgs = Object.entries(report.buildings ?? {})
        .map(([cat, cnt]) => `${cat}: ${cnt}`)
        .join(', ');
      const unitCats = (report.units?.categories ?? []).join(', ');
      contentHtml = `
        <p>${caughtNote}</p>
        <p><strong>Erfolgsquote:</strong> ${successRatePercent}%</p>
        <p><strong>Gebäude:</strong> ${bldgs || '–'}</p>
        <p><strong>Einheitenkategorien:</strong> ${unitCats || '–'}</p>
      `;
    } else {
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
        <p><strong>Erfolgsquote:</strong> ${successRatePercent}%</p>
        <details open><summary><strong>🏗 Gebäude</strong></summary><ul>${bldgs || '<li>Keine</li>'}</ul></details>
        <details open><summary><strong>⚔️ Einheiten</strong></summary><ul>${units || '<li>Keine</li>'}</ul></details>
        <details open><summary><strong>🛡 Verteidigungen</strong></summary><ul>${defenses || '<li>Keine</li>'}</ul></details>
      `;
    }
  }

  card.innerHTML = `
    <div class="spy-card-header">
      <span class="spy-card-icon">${report.success ? '📋' : '❌'}</span>
      <strong>Bericht: ${r.target_username}</strong>
      <span class="spy-card-date">${date}</span>
    </div>
    <div class="spy-card-meta">Entsandte Spione: ${r.spies_sent} | Zurückgekehrt: ${r.spies_returned ?? '–'}</div>
    <div class="spy-card-content">${contentHtml}</div>
  `;
  return card;
}

async function loadSpyReports() {
  try {
    const res = await apiGet('/espionage/reports');
    const reports = res.data ?? [];

    if (!reports.length) {
      spyReportsList.innerHTML = '<div class="spy-empty">Noch keine Berichte vorhanden.</div>';
      return;
    }

    spyReportsList.innerHTML = '';
    for (const r of reports) {
      spyReportsList.appendChild(renderSpyReport(r));
    }
  } catch (err) {
    spyReportsList.innerHTML = `<div class="spy-error">${err.message}</div>`;
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
  loadCombatMissions();
  loadCombatReports();
});
window.addEventListener('combat-return', () => {
  loadCombatMissions();
  loadCombatReports();
});
window.addEventListener('combat-incoming', () => {
  loadCombatMissions();
});
window.addEventListener('spy-return', () => {
  loadSpyMissions();
  loadSpyReports();
});
window.addEventListener('spy-mission-update', () => {
  loadSpyMissions();
  loadSpyReports();
});

setupTabs();
await initShell();
clearCountdowns();
await Promise.all([loadCombatMissions(), loadCombatReports(), loadSpyMissions(), loadSpyReports()]);

setInterval(tickCountdowns, 1000);
setInterval(async () => {
  clearCountdowns();
  await Promise.all([loadCombatMissions(), loadSpyMissions()]);
}, 10000);
setInterval(async () => {
  await Promise.all([loadCombatReports(), loadSpyReports()]);
}, 30000);
