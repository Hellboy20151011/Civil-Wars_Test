import { initShell, getAuth } from '/scripts/shell.js';

const API_BASE_URL = 'http://localhost:3000';

const auth = getAuth();
if (!auth) throw new Error('Nicht eingeloggt');

const UNIT_CATEGORIES = [
  {
    key: 'infantry',
    title: 'Infanterie',
    description: 'Bodeneinheiten – Soldaten, Pioniere und Spezialisten.',
  },
  {
    key: 'vehicle',
    title: 'Fahrzeuge',
    description: 'Gepanzerte Fahrzeuge und Artillerie.',
  },
  {
    key: 'ship',
    title: 'Marine',
    description: 'Kriegsschiffe und Marineeinheiten.',
  },
  {
    key: 'air',
    title: 'Luftwaffe',
    description: 'Kampfflugzeuge, Bomber und Luftabwehr.',
  },
  {
    key: 'spionage',
    title: 'Spionage',
    description: 'Geheimdiensteinheiten und verdeckte Operationen.',
  },
  {
    key: 'defense',
    title: 'Verteidigung',
    description: 'Stationäre Verteidigungsanlagen.',
  },
];

const militaerState = {
  selectedCategory: null,
  unitTypes: [],
  myUnits: [],
  message: '',
};

function getSelectedCategory() {
  const selected = new URLSearchParams(window.location.search).get('category');
  return UNIT_CATEGORIES.some(c => c.key === selected) ? selected : null;
}

function setSelectedCategory(categoryKey) {
  const url = new URL(window.location.href);
  if (!categoryKey) {
    url.searchParams.delete('category');
  } else {
    url.searchParams.set('category', categoryKey);
  }
  window.history.pushState({}, '', url);
}

function syncSidebarCategorySelection() {
  const selected = militaerState.selectedCategory;
  const links = document.querySelectorAll('#sidebar .submenu-link');
  links.forEach((link) => {
    const url = new URL(link.href, window.location.origin);
    if (url.pathname.toLowerCase() !== '/militaer.html') return;
    const category = url.searchParams.get('category');
    link.classList.toggle('is-active', selected === category);
  });
}

function changeCategory(categoryKey, pushHistory = true) {
  militaerState.selectedCategory = UNIT_CATEGORIES.some(c => c.key === categoryKey) ? categoryKey : null;
  if (pushHistory) {
    setSelectedCategory(militaerState.selectedCategory);
  }
  renderMilitaer(document.getElementById('Militaer'));
  syncSidebarCategorySelection();
}

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

function renderMilitaer(container) {
  if (!container) return;
  container.innerHTML = '';

  const heading = document.createElement('h2');
  heading.textContent = 'Militär – Einheiten ausbilden';

  const msgEl = document.createElement('p');
  msgEl.id = 'mil-message';
  msgEl.className = 'dash-message';
  msgEl.textContent = militaerState.message;

  container.append(heading, msgEl);

  const { unitTypes, myUnits, selectedCategory } = militaerState;

  const grid = document.createElement('div');
  grid.className = 'category-grid';

  const sectionTitle = document.createElement('h3');

  if (!selectedCategory) {
    sectionTitle.textContent = 'Einheitenkategorien';
    container.appendChild(sectionTitle);

    UNIT_CATEGORIES.forEach(({ key, title, description }) => {
      const catUnits = unitTypes.filter(u => u.category === key);
      if (catUnits.length === 0) return;

      const card = document.createElement('article');
      card.className = 'category-card';

      const h = document.createElement('h3');
      h.textContent = title;

      const desc = document.createElement('p');
      desc.textContent = description;

      const count = document.createElement('p');
      count.className = 'category-count';
      count.textContent = `${catUnits.length} Einheitentypen verfügbar`;

      const openBtn = document.createElement('button');
      openBtn.className = 'primary-action';
      openBtn.textContent = 'Kategorie öffnen';
      openBtn.addEventListener('click', () => changeCategory(key));

      card.append(h, desc, count, openBtn);
      grid.appendChild(card);
    });

    container.appendChild(grid);
    return;
  }

  const selectedDef = UNIT_CATEGORIES.find(c => c.key === selectedCategory);
  sectionTitle.textContent = selectedDef ? `Kategorie: ${selectedDef.title}` : 'Kategorie';
  container.appendChild(sectionTitle);

  const backBtn = document.createElement('button');
  backBtn.className = 'secondary-action';
  backBtn.textContent = 'Zurück zur Übersicht';
  backBtn.addEventListener('click', () => changeCategory(null));
  container.appendChild(backBtn);

  const catUnits = unitTypes.filter(u => u.category === selectedCategory);

  if (catUnits.length === 0) {
    const empty = document.createElement('p');
    empty.textContent = 'Keine Einheiten in dieser Kategorie verfügbar.';
    container.appendChild(empty);
    return;
  }

  const card = document.createElement('article');
  card.className = 'category-card';

  const cardTitle = document.createElement('h3');
  cardTitle.textContent = selectedDef?.title ?? selectedCategory;
  card.appendChild(cardTitle);

  catUnits.forEach((ut) => {
    const owned = myUnits.find(u => u.unit_type_id === ut.id || u.name === ut.name);

    const row = document.createElement('div');
    row.className = 'building-type-row';

    const name = document.createElement('strong');
    name.textContent = ut.name;

    const req = document.createElement('span');
    req.className = 'build-cost';
    req.textContent = `Benötigt: ${ut.building_requirement}`;

    const costs = [];
    if (ut.money_cost > 0) costs.push(`💰 ${Number(ut.money_cost).toLocaleString('de-DE')}`);
    if (ut.steel_cost > 0) costs.push(`⚙️ ${Number(ut.steel_cost).toLocaleString('de-DE')}`);
    if (ut.fuel_cost  > 0) costs.push(`🛢️ ${Number(ut.fuel_cost).toLocaleString('de-DE')}`);

    const costSpan = document.createElement('span');
    costSpan.className = 'build-cost';
    costSpan.textContent = costs.length > 0 ? costs.join('  ') : 'Kostenlos';

    const stats = document.createElement('span');
    stats.className = 'build-cost';
    stats.textContent = `HP: ${ut.hitpoints}  ⚔️ ${ut.attack_points}  🛡️ ${ut.defense_points}`;

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
    input.style.width = '60px';

    const btn = document.createElement('button');
    btn.className = 'primary-action';
    btn.textContent = owned ? 'Weitere ausbilden' : 'Ausbilden';
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      input.disabled = true;
      const msg = document.getElementById('mil-message');
      try {
        const quantity = Math.max(1, Math.min(999, Number(input.value) || 1));
        const result = await apiFetch('/units/train', {
          method: 'POST',
          body: JSON.stringify({ unit_type_id: ut.id, quantity }),
        });
        militaerState.message = result.message ?? '';
        input.value = '1';
        const updatedUnits = await apiFetch('/units/me');
        militaerState.myUnits = updatedUnits;
        await initShell();
        renderMilitaer(container);
        syncSidebarCategorySelection();
      } catch (err) {
        if (msg) msg.textContent = err.message;
        btn.disabled = false;
        input.disabled = false;
      }
    });

    btnContainer.append(input, btn);
    row.append(name, req, costSpan, stats, btnContainer);
    card.appendChild(row);
  });

  grid.appendChild(card);
  container.appendChild(grid);
}

function attachSidebarInterception() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar || sidebar.dataset.militaerInterceptAttached === 'true') return;

  sidebar.dataset.militaerInterceptAttached = 'true';
  sidebar.addEventListener('click', (event) => {
    const anchor = event.target.closest('a');
    if (!anchor) return;

    const url = new URL(anchor.href, window.location.origin);
    if (url.pathname.toLowerCase() !== '/militaer.html') return;

    event.preventDefault();
    changeCategory(url.searchParams.get('category'));
  });
}

async function init() {
  const container = document.getElementById('Militaer');
  if (!container) return;

  await initShell();
  attachSidebarInterception();

  container.innerHTML = '';

  try {
    const [unitTypes, myUnits] = await Promise.all([
      apiFetch('/units/types'),
      apiFetch('/units/me'),
    ]);

    militaerState.unitTypes = unitTypes;
    militaerState.myUnits = myUnits;
    militaerState.selectedCategory = getSelectedCategory();

    renderMilitaer(container);
    syncSidebarCategorySelection();
  } catch (err) {
    console.error(err);
    container.innerHTML = `<p style="color:#f88">Fehler beim Laden: ${err.message}</p>`;
  }
}

window.addEventListener('popstate', () => {
  militaerState.selectedCategory = getSelectedCategory();
  renderMilitaer(document.getElementById('Militaer'));
  syncSidebarCategorySelection();
});

init();
