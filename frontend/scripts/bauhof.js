import { initShell, getAuth } from '/scripts/shell.js';

const API_BASE_URL = 'http://localhost:3000';

const auth = getAuth();
if (!auth) throw new Error('Nicht eingeloggt');

// ── Hilfsfunktion: API-Call ───────────────────────────────
async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${auth.token}`,
      ...options.headers,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.message || 'Fehler'), { status: res.status });
  return data;
}

// ── Bauwarteschlange rendern ──────────────────────────────
function renderQueue(container, queue) {
  let queueSection = container.querySelector('.queue-section');
  if (!queueSection) {
    queueSection = document.createElement('section');
    queueSection.className = 'queue-section';
    const h = document.createElement('h3');
    h.textContent = 'Bauwarteschlange';
    queueSection.appendChild(h);
    container.appendChild(queueSection);
  }
  // Alles außer dem Heading leeren
  while (queueSection.children.length > 1) queueSection.removeChild(queueSection.lastChild);

  if (queue.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'Keine Gebäude in der Bauwarteschlange.';
    queueSection.appendChild(empty);
    return;
  }

  queue.forEach(entry => {
    const row = document.createElement('div');
    row.className = 'queue-row';

    const name = document.createElement('span');
    name.textContent = entry.anzahl > 1 ? `${entry.anzahl}x ${entry.name}` : entry.name;

    const timer = document.createElement('span');
    timer.className = 'countdown-timer';
    row.append(name, timer);
    queueSection.appendChild(row);

    // Countdown pro Eintrag
    const endMs = new Date(entry.fertig_am).getTime();
    const tick = setInterval(() => {
      const remaining = Math.max(0, endMs - Date.now());
      if (remaining <= 0) {
        clearInterval(tick);
        timer.textContent = '✓ Fertig';
        // Seite nach kurzer Pause neu laden um Gebäude einzubuchen
        setTimeout(() => init(), 1500);
      } else {
        const s = Math.ceil(remaining / 1000);
        const m = Math.floor(s / 60);
        timer.textContent = m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
      }
    }, 500);
  });
}

// ── Gebäudeliste rendern ──────────────────────────────────
function renderMyBuildings(container, buildings) {
  let section = container.querySelector('.my-buildings-section');
  if (!section) {
    section = document.createElement('section');
    section.className = 'my-buildings-section';
    const h = document.createElement('h3');
    h.textContent = 'Meine Gebäude';
    section.appendChild(h);
    container.insertBefore(section, container.firstChild);
  }
  while (section.children.length > 1) section.removeChild(section.lastChild);

  if (buildings.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = '- Noch keine Gebäude gebaut! -';
    section.appendChild(empty);
    return;
  }

  buildings.forEach(b => {
    const row = document.createElement('div');
    row.className = 'building-row';

    const name = document.createElement('span');
    name.textContent = b.anzahl > 1 ? `${b.name} (${b.anzahl}x)` : b.name;

    const cat = document.createElement('span');
    cat.className = 'building-category';
    cat.textContent = b.category || b.kategorie || '';

    row.append(name, cat);
    section.appendChild(row);
  });
}

// ── Kategorien + Gebäudetypen ─────────────────────────────
async function renderCategories(container, myBuildings, queue) {
  container.innerHTML = '';

  const heading = document.createElement('h2');
  heading.textContent = 'Bauhof – Verfügbare Gebäude';

  const msgEl = document.createElement('p');
  msgEl.id = 'build-message';
  msgEl.style.color = '#7cc8ff';

  container.append(heading, msgEl);

  renderMyBuildings(container, myBuildings);
  renderQueue(container, queue);

  // Gebäudetypen laden
  const types = await apiFetch('/buildings/types');

  const categories = [
    { key: 'infrastructure', title: 'Infrastruktur', description: 'Grundversorgung, Energie und Rohstoffe.' },
    { key: 'housing', title: 'Unterkünfte', description: 'Wohngebäude und Einkommen.' },
    { key: 'military', title: 'Militär', description: 'Kasernen und Produktionsanlagen für Einheiten.' },
    { key: 'government', title: 'Regierung', description: 'Verwaltung, Forschung und Wirtschaft.' },
    { key: 'defense', title: 'Verteidigung', description: 'Schutzanlagen für Land, See und Luft.' },
  ];

  const grid = document.createElement('div');
  grid.className = 'category-grid';

  categories.forEach(({ key, title, description }) => {
    const catBuildings = types.filter(t => t.category === key && t.name !== 'Rathaus');
    if (catBuildings.length === 0) return;

    const card = document.createElement('article');
    card.className = 'category-card';

    const h = document.createElement('h3');
    h.textContent = title;

    const desc = document.createElement('p');
    desc.textContent = description;

    card.append(h, desc);

    catBuildings.forEach(bt => {
      const owned = myBuildings.find(b => Number(b.id) === Number(bt.id));
      const inQueue = queue.find(q => q.building_type_id === bt.id);

      const bRow = document.createElement('div');
      bRow.className = 'building-type-row';

      const bName = document.createElement('strong');
      bName.textContent = bt.name;

      const costs = [];
      if (bt.money_cost > 0) costs.push(`💰 ${Number(bt.money_cost).toLocaleString('de-DE')}`);
      if (bt.stone_cost  > 0) costs.push(`🪨 ${Number(bt.stone_cost).toLocaleString('de-DE')}`);
      if (bt.steel_cost  > 0) costs.push(`⚙️ ${Number(bt.steel_cost).toLocaleString('de-DE')}`);
      if (bt.fuel_cost   > 0) costs.push(`🛢️ ${Number(bt.fuel_cost).toLocaleString('de-DE')}`);

      const costSpan = document.createElement('span');
      costSpan.className = 'build-cost';
      costSpan.textContent = costs.length > 0 ? costs.join('  ') : 'Kostenlos';

      const btnContainer = document.createElement('div');
      btnContainer.style.display = 'flex';
      btnContainer.style.gap = '8px';
      btnContainer.style.alignItems = 'center';

      const input = document.createElement('input');
      input.type = 'number';
      input.min = '1';
      input.max = '999';
      input.value = '1';
      input.className = 'build-quantity-input';
      input.placeholder = 'Anzahl';
      input.style.width = '60px';
      input.style.padding = '4px 6px';
      input.style.borderRadius = '3px';
      input.style.border = '1px solid #aaa';

      const btn = document.createElement('button');
      btn.className = 'primary-action';
      btn.dataset.buildId = bt.id;

      if (inQueue) {
        btn.textContent = 'In Warteschlange…';
        btn.disabled = true;
        input.disabled = true;
      } else {
        btn.textContent = owned ? `Weiteren bauen` : 'Bauen';
        btn.addEventListener('click', async () => {
          btn.disabled = true;
          input.disabled = true;
          const msg = document.getElementById('build-message');
          try {
            const quantity = Math.max(1, Math.min(999, Number(input.value) || 1));
            const result = await apiFetch('/buildings/build', {
              method: 'POST',
              body: JSON.stringify({ building_type_id: bt.id, anzahl: quantity }),
            });
            const successMsg = result.message ?? '';
            input.value = '1';
            await init();
            const newMsg = document.getElementById('build-message');
            if (newMsg) newMsg.textContent = successMsg;
          } catch (err) {
            if (msg) msg.textContent = err.message;
            btn.disabled = false;
            input.disabled = false;
          }
        });
      }

      btnContainer.append(input, btn);
      bRow.append(bName, costSpan, btnContainer);
      card.appendChild(bRow);
    });

    grid.appendChild(card);
  });

  container.appendChild(grid);
}

// ── Hauptlogik ────────────────────────────────────────────
async function init() {
  const container = document.getElementById('Bauhof');
  if (!container) return;

  await initShell();

  container.innerHTML = '';

  try {
    const { buildings, queue } = await apiFetch('/buildings/me');
    await renderCategories(container, buildings, queue);
  } catch (err) {
    console.error(err);
    const errMsg = document.createElement('p');
    errMsg.textContent = `Fehler beim Laden: ${err.message}`;
    errMsg.style.color = '#f88';
    container.appendChild(errMsg);
  }
}

init();

