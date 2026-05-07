// Gemeinsames Layout-Modul für alle Spielseiten (außer Login)
// Exportiert: initShell(), getAuth(), showToast()

import { API_BASE_URL } from '/scripts/config.js';
import { formatTimeLeft } from '/scripts/utils/time.js';
import { openUserStatusStream } from '/scripts/api/sse.js';
import { renderSidebar } from '/scripts/components/sidebar.js';
import { renderResourceBar, renderProductionPanel } from '/scripts/components/resource-panel.js';
import { showToast } from '/scripts/utils/toast.js';
export { showToast };

let liveEventSource = null;
let liveEventSourceToken = null;
let latestStatusPayload = null;
let latestResearchOverview = null;
let researchOverviewPollTimer = null;
let researchCountdownTimer = null;
let researchPollingToken = null;
const LOGIN_PAGE_PATH = '/pages/index.html';

function stopResearchTimers() {
  if (researchOverviewPollTimer) {
    clearTimeout(researchOverviewPollTimer);
    researchOverviewPollTimer = null;
  }
  if (researchCountdownTimer) {
    clearInterval(researchCountdownTimer);
    researchCountdownTimer = null;
  }
  researchPollingToken = null;
}

async function fetchResearchOverview(token) {
  try {
    const res = await fetch(`${API_BASE_URL}/research/overview`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function updateResearchCountdownText() {
  const target = document.querySelector('#production-panel [data-research-countdown="active"]');
  const endAt = latestResearchOverview?.activeResearch?.endsAt;
  if (!target || !endAt) return;
  target.textContent = formatTimeLeft(endAt);
}

async function refreshResearchOverview(token) {
  const overview = await fetchResearchOverview(token);
  latestResearchOverview = overview;
  if (latestStatusPayload) {
    renderProductionPanel(latestStatusPayload, latestResearchOverview);
    updateResearchCountdownText();
  }
}

function startResearchOverviewPolling(token) {
  stopResearchTimers();
  researchPollingToken = token;

  researchCountdownTimer = setInterval(() => {
    updateResearchCountdownText();
  }, 1000);

  const scheduleNext = (delayMs) => {
    researchOverviewPollTimer = setTimeout(async () => {
      if (!researchPollingToken) return;
      if (!document.hidden) {
        await refreshResearchOverview(token);
      }
      const hasActiveResearch = Boolean(latestResearchOverview?.activeResearch);
      scheduleNext(hasActiveResearch ? 15000 : 60000);
    }, delayMs);
  };

  const hasActiveResearch = Boolean(latestResearchOverview?.activeResearch);
  scheduleNext(hasActiveResearch ? 15000 : 60000);
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden || !researchPollingToken) return;

  refreshResearchOverview(researchPollingToken);
});

function redirectToLogin() {
  // replace() verhindert, dass die geschützte Seite per Browser-Zurück direkt wieder erscheint.
  window.location.replace(LOGIN_PAGE_PATH);
}

function handleLogout() {
  stopLiveUpdates();
  sessionStorage.removeItem('currentUser');
  sessionStorage.removeItem('authToken');
  redirectToLogin();
}

export function getAuth() {
  const raw = sessionStorage.getItem('currentUser');
  const token = sessionStorage.getItem('authToken');
  if (!raw || !token || token === 'undefined' || token === 'null') {
    stopLiveUpdates();
    sessionStorage.removeItem('currentUser');
    sessionStorage.removeItem('authToken');
    redirectToLogin();
    return null;
  }
  return { user: JSON.parse(raw), token };
}

export async function initShell(navLinks = []) {
  const auth = getAuth();
  if (!auth) return;

  // /me lädt Ressourcen, Strom, Produktion und Gebäude in einem Request
  try {
    const [res, overview] = await Promise.all([
      fetch(`${API_BASE_URL}/me`, {
        headers: { Authorization: `Bearer ${auth.token}` }
      }),
      fetchResearchOverview(auth.token),
    ]);
    if (!res.ok) throw new Error('Status-Abruf fehlgeschlagen');
    const status = await res.json();
    latestStatusPayload = status;
    latestResearchOverview = overview;
    renderSidebar(navLinks, status, handleLogout);
    renderResourceBar(status);
    renderProductionPanel(status, latestResearchOverview);
    updateResearchCountdownText();
    startResearchOverviewPolling(auth.token);
    startLiveUpdates(auth.token);
  } catch (err) {
    renderSidebar(navLinks, null, handleLogout);
    console.error(err);
    const bar = document.getElementById('resource-bar');
    if (bar) {
      bar.textContent = 'Ressourcen nicht verfügbar';
      bar.style.color = '#f88';
    }
  }
}

export async function refreshShellStatus(tokenOverride) {
  const auth = getAuth();
  const token = tokenOverride || auth?.token;
  if (!token) return null;

  const res = await fetch(`${API_BASE_URL}/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Status-Abruf fehlgeschlagen');

  const status = await res.json();
  latestStatusPayload = status;
  renderResourceBar(latestStatusPayload);
  renderProductionPanel(latestStatusPayload, latestResearchOverview);
  updateResearchCountdownText();
  return status;
}

async function startLiveUpdates(token) {
  if (!token) return;

  if (liveEventSource && liveEventSourceToken === token) {
    return;
  }

  if (liveEventSource) {
    liveEventSource.close();
    liveEventSource = null;
  }

  let source;
  try {
    source = await openUserStatusStream(token);
  } catch (err) {
    console.error('SSE-Stream konnte nicht gestartet werden:', err);
    return;
  }

  source.addEventListener('status', (event) => {
    try {
      const payload = JSON.parse(event.data || '{}');
      if (!payload.status) return;
      latestStatusPayload = payload.status;
      renderResourceBar(latestStatusPayload);
      renderProductionPanel(latestStatusPayload, latestResearchOverview);
      updateResearchCountdownText();
    } catch (err) {
      console.error('SSE status parse error:', err);
    }
  });

  source.addEventListener('combat_incoming', (event) => {
    try {
      const d = JSON.parse(event.data || '{}');
      const eta = new Date(d.arrivalTime);
      const mins = Math.round((eta - Date.now()) / 60000);
      showToast(`⚔️ Eingehender Angriff von ${d.attackerUsername}! Ankunft in ~${mins} min.`, 'danger');
      globalThis.dispatchEvent(new globalThis.CustomEvent('combat-incoming', { detail: d }));
    } catch (err) {
      console.error('SSE combat_incoming parse error:', err);
    }
  });

  source.addEventListener('combat_result', (event) => {
    try {
      const d = JSON.parse(event.data || '{}');
      const msg = d.attackerWon
        ? `⚔️ Kampf gegen ${d.defenderUsername}: Sieg! Einheiten kehren zurück.`
        : `⚔️ Kampf gegen ${d.defenderUsername}: Niederlage. Einheiten kehren zurück.`;
      showToast(msg, d.attackerWon ? 'success' : 'warning');
      globalThis.dispatchEvent(new globalThis.CustomEvent('combat-result', { detail: d }));
    } catch (err) {
      console.error('SSE combat_result parse error:', err);
    }
  });

  source.addEventListener('combat_return', (event) => {
    try {
      const d = JSON.parse(event.data || '{}');
      showToast(`🏠 Deine Einheiten aus dem Angriff auf ${d.defenderUsername} sind heimgekehrt.`, 'info');
      globalThis.dispatchEvent(new globalThis.CustomEvent('combat-return', { detail: d }));
    } catch (err) {
      console.error('SSE combat_return parse error:', err);
    }
  });

  source.addEventListener('spy_detected', (event) => {
    try {
      const d = JSON.parse(event.data || '{}');
      const spiesDetected = Number(d.spiesDetected ?? 0);
      showToast(`🚨 Spion(e) entdeckt! ${spiesDetected} Spion(e) von ${d.originUsername} gefasst.`, 'warning');
    } catch (err) {
      console.error('SSE spy_detected parse error:', err);
    }
  });

  source.addEventListener('spy_mission_update', (event) => {
    try {
      const d = JSON.parse(event.data || '{}');
	    if (d.level === 'failed' || d.status === 'aborted') {
        showToast(`🕵️ Spionage bei ${d.targetUsername} fehlgeschlagen – alle Spione erwischt.`, 'danger');
      } else {
	      showToast(`🕵️ Spionage bei ${d.targetUsername} abgeschlossen. Spione kehren zurück.`, 'info');
      }
      globalThis.dispatchEvent(new globalThis.CustomEvent('spy-mission-update', { detail: d }));
    } catch (err) {
      console.error('SSE spy_mission_update parse error:', err);
    }
  });

  source.addEventListener('spy_return', (event) => {
    try {
      const d = JSON.parse(event.data || '{}');
      showToast(`🏠 Deine Spione von ${d.targetUsername} sind zurückgekehrt.`, 'success');
      // Spionage-Seite live aktualisieren falls offen
      globalThis.dispatchEvent(new globalThis.CustomEvent('spy-return', { detail: d }));
    } catch (err) {
      console.error('SSE spy_return parse error:', err);
    }
  });

  source.addEventListener('error', () => {
    // EventSource reconnectet automatisch.
  });

  liveEventSource = source;
  liveEventSourceToken = token;
}

function stopLiveUpdates() {
  if (liveEventSource) {
    liveEventSource.close();
    liveEventSource = null;
  }
  liveEventSourceToken = null;
  latestStatusPayload = null;
  latestResearchOverview = null;
  stopResearchTimers();
}


