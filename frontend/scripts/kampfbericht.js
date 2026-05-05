import { initShell, getAuth } from '/scripts/shell.js';
import { API_BASE_URL } from '/scripts/config.js';

const auth = getAuth();
if (!auth) throw new Error('Nicht eingeloggt');

const content = document.getElementById('report-content');

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

function pct(value) {
  return `${Math.round((Number(value) || 0) * 100)}%`;
}

function esc(str) {
  return String(str ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function rowsForAttacker(list) {
  if (!list?.length) return '<tr><td colspan="3">Keine Daten</td></tr>';
  return list
    .map((u) => `<tr><td>${esc(u.unitName)}</td><td>${Number(u.sent ?? 0)}</td><td>${Number(u.losses ?? 0)}</td></tr>`)
    .join('');
}

function rowsForDefender(list) {
  if (!list?.length) return '<tr><td colspan="3">Keine Daten</td></tr>';
  return list
    .map((u) => `<tr><td>${esc(u.unitName)}</td><td>${Number(u.losses ?? 0)}</td><td>${Number(u.remaining ?? 0)}</td></tr>`)
    .join('');
}

function rowsForPlunder(list) {
  if (!list?.length) return '<tr><td colspan="3"><em>Keine Gebäude geplündert</em></td></tr>';
  return list
    .map(
      (b) =>
        `<tr><td>${esc(b.name)}</td><td style="text-align:right;">${Number(b.removed)}</td><td style="text-align:right;">${Number(b.remaining)}</td></tr>`
    )
    .join('');
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
    const attackerRate = pct(result.attackerCasualtyRate);
    const defenderRate = pct(result.defenderCasualtyRate);

    const attackerUnits = result.attackerUnits ?? [];

    const reportDate = new Date(mission.arrival_time).toLocaleString('de-DE');

    content.innerHTML = `
      <div class="spy-card">
        <div class="spy-card-header">
          <span class="spy-card-icon">${myWin ? '🏆' : '⚠️'}</span>
          <strong>${isAttacker ? 'Angriff auf' : 'Verteidigung gegen'} ${esc(opponent)}</strong>
          <span class="spy-card-date">${reportDate}</span>
        </div>
        <div class="spy-card-body">
          <span>📏 Distanz: ${Number(mission.distance).toFixed(1)} Felder</span>
          <span>⚔ Ergebnis: ${myWin ? 'Sieg' : 'Niederlage'}</span>
          <span>📉 Verlustrate Angreifer: ${attackerRate}</span>
          <span>📉 Verlustrate Verteidiger: ${defenderRate}</span>
        </div>
      </div>

      <div class="spy-card" style="margin-top:12px;">
        <div class="spy-card-header">
          <span class="spy-card-icon">🪖</span>
          <strong>Einheitenvergleich</strong>
        </div>
        <div class="spy-card-content" style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
          <div>
            <h4 style="margin:0 0 8px 0;">Angreifer</h4>
            <table style="width:100%;border-collapse:collapse;">
              <thead>
                <tr><th style="text-align:left;">Einheit</th><th style="text-align:right;">Gesendet</th><th style="text-align:right;">Verluste</th></tr>
              </thead>
              <tbody>${rowsForAttacker(attackerUnits)}</tbody>
            </table>
          </div>
          <div>
            <h4 style="margin:0 0 8px 0;">Verteidiger</h4>
            <table style="width:100%;border-collapse:collapse;">
              <thead>
                <tr><th style="text-align:left;">Einheit</th><th style="text-align:right;">Verluste</th><th style="text-align:right;">Uebrig</th></tr>
              </thead>
              <tbody>${rowsForDefender(result.defenderUnits)}</tbody>
            </table>
          </div>
        </div>
      </div>
      <div class="spy-card" style="margin-top:12px;">
        <div class="spy-card-header">
          <span class="spy-card-icon">🏗️</span>
          <strong>Geplünderte Gebäude</strong>
        </div>
        <div class="spy-card-content">
          <table style="width:100%;border-collapse:collapse;">
            <thead>
              <tr>
                <th style="text-align:left;">Gebäude</th>
                <th style="text-align:right;">Zerstört</th>
                <th style="text-align:right;">Verbleibend</th>
              </tr>
            </thead>
            <tbody>${rowsForPlunder(result.plunderedBuildings)}</tbody>
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
