import { initShell, getAuth } from '/scripts/shell.js';
import { API_BASE_URL } from '/scripts/config.js';

const auth = getAuth();
if (!auth) throw new Error('Nicht eingeloggt');

const content = document.getElementById('report-content');

function parseResult(result) {
  if (!result) return null;
  if (typeof result === 'string') {
    try { return JSON.parse(result); } catch { return null; }
  }
  return result;
}

function pct(value) {
  return `${Math.round((Number(value) || 0) * 100)} %`;
}

function esc(str) {
  return String(str ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function attackerRows(list) {
  if (!list?.length) return '<tr><td colspan="4" style="padding:8px 6px;color:var(--text-dim)">Keine Daten</td></tr>';
  return list.map((u) => {
    const sent = Number(u.sent ?? 0);
    const losses = Number(u.losses ?? 0);
    const survived = Number(u.survived ?? sent - losses);
    return `<tr>
      <td>${esc(u.unitName)}</td>
      <td>${sent}</td>
      <td class="${losses > 0 ? 'red' : ''}">${losses > 0 ? `−${losses}` : '0'}</td>
      <td class="${survived === sent ? 'green' : survived > 0 ? '' : 'red'}">${survived}</td>
    </tr>`;
  }).join('');
}

function defenderRows(list) {
  if (!list?.length) return '<tr><td colspan="3" style="padding:8px 6px;color:var(--text-dim)">Keine Daten</td></tr>';
  return list.map((u) => {
    const losses = Number(u.losses ?? 0);
    const remaining = Number(u.remaining ?? 0);
    return `<tr>
      <td>${esc(u.unitName)}</td>
      <td class="${losses > 0 ? 'red' : ''}">${losses > 0 ? `−${losses}` : '0'}</td>
      <td class="${remaining === 0 ? 'red' : 'green'}">${remaining}</td>
    </tr>`;
  }).join('');
}

function plunderRows(list) {
  if (!list?.length) return '<tr><td colspan="3" style="padding:8px 6px;color:var(--text-dim);font-style:italic;">Keine Gebäude geplündert</td></tr>';
  return list.map((b) =>
    `<tr>
      <td>${esc(b.name)}</td>
      <td class="red">${Number(b.removed)}</td>
      <td>${Number(b.remaining)}</td>
    </tr>`
  ).join('');
}

function roundRows(log) {
  if (!log?.length) return '<tr><td colspan="5" style="padding:8px;color:var(--text-dim)">Keine Rundendaten</td></tr>';
  return log.map((row) =>
    `<tr class="${(row.aKilled > 0 || row.dKilled > 0) ? 'cb-round-row-kill' : ''}">
      <td>${row.r}</td>
      <td>${row.aAlive + row.aKilled}</td>
      <td class="${row.aKilled > 0 ? 'red' : ''}">${row.aKilled > 0 ? `−${row.aKilled}` : '—'}</td>
      <td class="${row.dKilled > 0 ? 'red' : ''}">${row.dKilled > 0 ? `−${row.dKilled}` : '—'}</td>
      <td>${row.dAlive + row.dKilled}</td>
    </tr>`
  ).join('');
}

async function loadReport() {
  const missionIdParam = new URLSearchParams(window.location.search).get('missionId');
  const missionId = Number(missionIdParam);

  if (!Number.isInteger(missionId) || missionId <= 0) {
    content.innerHTML = '<div class="spy-error">Ungueltige missionId in der URL.</div>';
    return;
  }

  try {
    const res = await fetch(`${API_BASE_URL}/combat/history/${missionId}`, {
      headers: { Authorization: `Bearer ${auth.token}` },
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(payload.message || 'Kampfbericht konnte nicht geladen werden');

    const mission = payload.data;
    const result = parseResult(mission.result);
    const isAttacker = Number(mission.attacker_id) === Number(auth.user.id);
    const opponent = isAttacker ? mission.defender_username : mission.attacker_username;

    if (!result) {
      content.innerHTML = '<div class="spy-error">Kein gueltiges Kampfergebnis vorhanden.</div>';
      return;
    }

    const attackerWon = result.attackerWon === true;
    const myWin = isAttacker ? attackerWon : !attackerWon;
    const reportDate = new Date(mission.arrival_time).toLocaleString('de-DE');
    const rounds = result.rounds ?? null;
    const roundLog = result.roundLog ?? [];
    const attackerUnits = result.attackerUnits ?? [];
    const defenderUnits = result.defenderUnits ?? [];

    const totalSent = attackerUnits.reduce((s, u) => s + Number(u.sent ?? 0), 0);
    const totalALoss = attackerUnits.reduce((s, u) => s + Number(u.losses ?? 0), 0);
    const totalDLoss = defenderUnits.reduce((s, u) => s + Number(u.losses ?? 0), 0);

    content.innerHTML = `
      <!-- ── Banner ── -->
      <div class="cb-banner ${myWin ? 'win' : 'loss'}">
        <div class="cb-banner-icon">${myWin ? '🏆' : '💀'}</div>
        <div>
          <div class="cb-banner-title">${myWin ? 'Sieg' : 'Niederlage'} – ${isAttacker ? 'Angriff auf' : 'Verteidigung gegen'} ${esc(opponent)}</div>
          <div class="cb-banner-sub">${reportDate} &nbsp;·&nbsp; Distanz: ${Number(mission.distance).toFixed(1)} Felder${rounds != null ? ` &nbsp;·&nbsp; ${rounds} Kampfrunden` : ''}</div>
        </div>
      </div>

      <!-- ── Kennzahlen ── -->
      <div class="cb-stats">
        <div class="cb-stat">
          <div class="cb-stat-label">Eingesetzt</div>
          <div class="cb-stat-value blue">${totalSent}</div>
        </div>
        <div class="cb-stat">
          <div class="cb-stat-label">Verluste Angreifer</div>
          <div class="cb-stat-value ${totalALoss > 0 ? 'red' : 'green'}">${totalALoss}</div>
        </div>
        <div class="cb-stat">
          <div class="cb-stat-label">Verluste Verteidiger</div>
          <div class="cb-stat-value ${totalDLoss > 0 ? 'red' : 'green'}">${totalDLoss}</div>
        </div>
        <div class="cb-stat">
          <div class="cb-stat-label">Verlustrate A.</div>
          <div class="cb-stat-value ${result.attackerCasualtyRate > 0 ? 'red' : 'green'}">${pct(result.attackerCasualtyRate)}</div>
        </div>
        <div class="cb-stat">
          <div class="cb-stat-label">Verlustrate V.</div>
          <div class="cb-stat-value ${result.defenderCasualtyRate > 0 ? 'red' : 'green'}">${pct(result.defenderCasualtyRate)}</div>
        </div>
      </div>

      <!-- ── Einheiten ── -->
      <div class="cb-section">
        <div class="cb-section-header">🪖 Einheitenvergleich</div>
        <div class="cb-section-body">
          <div class="cb-unit-grid">
            <div class="cb-unit-side">
              <h4>Angreifer</h4>
              <table class="cb-table">
                <thead><tr><th>Einheit</th><th>Gesandt</th><th>Verluste</th><th>Überlebt</th></tr></thead>
                <tbody>${attackerRows(attackerUnits)}</tbody>
              </table>
            </div>
            <div class="cb-unit-side">
              <h4>Verteidiger</h4>
              <table class="cb-table">
                <thead><tr><th>Einheit</th><th>Verluste</th><th>Übrig</th></tr></thead>
                <tbody>${defenderRows(defenderUnits)}</tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <!-- ── Kampfrunden ── -->
      ${rounds != null ? `
      <div class="cb-section">
        <div class="cb-section-header">🔄 Kampfrunden (${rounds} gesamt)</div>
        <div class="cb-section-body">
          <details class="cb-round-details">
            <summary>Rundenübersicht einblenden</summary>
            <div class="cb-round-scroll">
              <table class="cb-table">
                <thead>
                  <tr>
                    <th style="text-align:left;">Runde</th>
                    <th>Angreifer vorher</th>
                    <th>Gef. Angreifer</th>
                    <th>Gef. Verteidiger</th>
                    <th>Verteidiger vorher</th>
                  </tr>
                </thead>
                <tbody>${roundRows(roundLog)}</tbody>
              </table>
            </div>
          </details>
        </div>
      </div>` : ''}

      <!-- ── Plünderung ── -->
      <div class="cb-section">
        <div class="cb-section-header">🏗️ Geplünderte Gebäude</div>
        <div class="cb-section-body">
          <table class="cb-table">
            <thead><tr><th>Gebäude</th><th>Zerstört</th><th>Verbleibend</th></tr></thead>
            <tbody>${plunderRows(result.plunderedBuildings)}</tbody>
          </table>
        </div>
      </div>
    `;
  } catch (err) {
    content.innerHTML = `<div class="spy-error">${esc(err.message)}</div>`;
  }
}

await initShell();
await loadReport();
