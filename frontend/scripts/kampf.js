import { initShell, getAuth, refreshShellStatus } from '/scripts/shell.js';
import { API_BASE_URL } from '/scripts/config.js';

const auth = getAuth();
if (!auth) throw new Error('Nicht eingeloggt');

const container = document.getElementById('kampf-planung');

function getTargetId() {
  const id = Number(new URLSearchParams(window.location.search).get('target_id'));
  return Number.isFinite(id) && id > 0 ? id : null;
}

async function apiGet(path) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${auth.token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'Abruf fehlgeschlagen');
  return data;
}

async function apiPost(path, body) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${auth.token}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'Aktion fehlgeschlagen');
  return data;
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
  if (!target || !own) {
    throw new Error('Ziel konnte nicht geladen werden.');
  }

  const units = (Array.isArray(unitsRes) ? unitsRes : []).filter(
    (u) => u.quantity > 0 && !u.is_moving && u.category !== 'intel' && u.category !== 'defense'
  );
  let availableFuel = Number(meRes?.resources?.treibstoff ?? 0);
  const dist = distance(own, target);

  if (!units.length) {
    container.innerHTML = `
      <div class="spy-card">
        <div class="spy-card-header">
          <span class="spy-card-icon">⚔</span>
          <strong>Angriff auf ${target.username}</strong>
        </div>
        <div class="spy-card-content">Keine verfuegbaren Kampfeinheiten.</div>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="spy-card">
      <div class="spy-card-header">
        <span class="spy-card-icon">⚔</span>
        <strong>Angriff auf ${target.username}</strong>
      </div>
      <div class="spy-card-body">
        <span>📍 Ziel: (${target.koordinate_x}, ${target.koordinate_y})</span>
        <span>📏 Distanz: ${dist.toFixed(1)} Felder</span>
      </div>
      <div id="attack-units-list"></div>
      <div class="spy-card-content">
        <button id="btn-launch-attack" class="primary-action" disabled>Angriff starten</button>
        <span id="attack-fuel-badge" class="spy-fuel-badge" style="display:none">Nicht genug Treibstoff</span>
        <span id="attack-msg" class="build-cost" style="margin-left:10px"></span>
      </div>
    </div>
  `;

  const list = document.getElementById('attack-units-list');
  const launchBtn = document.getElementById('btn-launch-attack');
  const fuelBadge = document.getElementById('attack-fuel-badge');
  const msgNode = document.getElementById('attack-msg');

  for (const u of units) {
    const row = document.createElement('div');
    row.className = 'attack-unit-row';
    row.innerHTML = `
      <span class="attack-unit-name">${u.name}</span>
      <span class="attack-unit-avail">/${u.quantity}</span>
      <input class="attack-unit-qty" type="number" min="0" max="${u.quantity}" value="0" data-unit-id="${u.id}" data-fuel-cost="${Number(u.fuel_cost ?? 0)}" />
    `;
    list.appendChild(row);
  }

  const calculateFuelCost = () => {
    return [...list.querySelectorAll('.attack-unit-qty')]
      .filter((inp) => Number(inp.value) > 0)
      .reduce((sum, inp) => {
        const qty = Number(inp.value);
        const fuelPerUnit = Number(inp.dataset.fuelCost ?? 0);
        return sum + Math.ceil((fuelPerUnit * dist * qty) / 10);
      }, 0);
  };

  const updateState = () => {
    const any = [...list.querySelectorAll('.attack-unit-qty')].some((inp) => Number(inp.value) > 0);
    if (!any) {
      launchBtn.disabled = true;
      fuelBadge.style.display = 'none';
      msgNode.textContent = '';
      return;
    }

    const fuelCost = calculateFuelCost();
    const hasFuel = fuelCost <= availableFuel;
    launchBtn.disabled = !hasFuel;
    fuelBadge.style.display = hasFuel ? 'none' : 'inline-flex';

    if (!hasFuel) {
      msgNode.style.color = '#f87171';
      msgNode.textContent = `Zu wenig Treibstoff: ${fuelCost.toLocaleString('de-DE')} L benötigt, ${availableFuel.toLocaleString('de-DE')} L verfügbar.`;
    } else {
      msgNode.style.color = '#94a3b8';
      msgNode.textContent = `Treibstoffbedarf: ${fuelCost.toLocaleString('de-DE')} L | Verfügbar: ${availableFuel.toLocaleString('de-DE')} L`;
    }
  };

  list.addEventListener('input', updateState);

  launchBtn.addEventListener('click', async () => {
    const payloadUnits = [...list.querySelectorAll('.attack-unit-qty')]
      .map((inp) => ({ user_unit_id: Number(inp.dataset.unitId), quantity: Number(inp.value) }))
      .filter((entry) => entry.quantity > 0);

    if (!payloadUnits.length) return;
    if (launchBtn.disabled) return;

    launchBtn.disabled = true;
    msgNode.textContent = 'Starte Angriff...';
    try {
      const data = await apiPost('/combat/attack', { defender_id: Number(target.id), units: payloadUnits });
      availableFuel = Math.max(0, availableFuel - Number(data?.data?.fuelCost ?? 0));
      await refreshShellStatus(auth.token);
      updateState();
      const eta = new Date(data?.data?.arrivalTime);
      const mins = Math.round((eta - Date.now()) / 60000);
      msgNode.textContent = `Angriff gestartet. Ankunft in ~${mins} min.`;
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
  container.innerHTML = `<div class="spy-error">${err.message}</div>`;
}
