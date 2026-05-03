import { initShell, getAuth } from '/scripts/shell.js';
import { API_BASE_URL } from '/scripts/config.js';

const auth = getAuth();
if (!auth) throw new Error('Nicht eingeloggt');

const CATEGORIES = [
  {
    key: 'infrastructure',
    title: 'Industrie',
    description: 'Grundversorgung, Energie und Rohstoffe.',
    image: '/assets/images/categories/industrie.jpg',
  },
  {
    key: 'housing',
    title: 'Unterkünfte',
    description: 'Wohngebäude und Einkommen.',
    image: '/assets/images/categories/unterkünfte.jpg',
  },
  {
    key: 'military',
    title: 'Militär',
    description: 'Kasernen und Produktionsanlagen für Einheiten.',
    image: '/assets/images/categories/militär.jpg',
  },
  {
    key: 'government',
    title: 'Regierung',
    description: 'Verwaltung, Forschung und Wirtschaft.',
    image: '/assets/images/categories/regierung.jpg',
  },
  {
    key: 'defense',
    title: 'Verteidigung',
    description: 'Schutzanlagen für Land, See und Luft.',
    image: '/assets/images/categories/verteidigung.jpg',
  },
];

const bauhofState = {
  selectedCategory: null,
  types: [],
  buildings: [],
  queue: [],
  message: '',
};

function getSelectedCategory() {
  const selected = new URLSearchParams(window.location.search).get('category');
  return CATEGORIES.some(c => c.key === selected) ? selected : null;
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
  const selected = bauhofState.selectedCategory;
  const links = document.querySelectorAll('#sidebar .submenu-link');
  links.forEach((link) => {
    const url = new URL(link.href, window.location.origin);
    const category = url.searchParams.get('category');
    link.classList.toggle('is-active', selected === category);
  });
}

function changeCategory(categoryKey, pushHistory = true) {
  bauhofState.selectedCategory = CATEGORIES.some(c => c.key === categoryKey) ? categoryKey : null;
  if (pushHistory) {
    setSelectedCategory(bauhofState.selectedCategory);
  }
  renderCategories(document.getElementById('Bauhof'));
  syncSidebarCategorySelection();
}

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

// ── Kategorien + Gebäudetypen ─────────────────────────────
function renderCategories(container) {
  if (!container) return;
  container.innerHTML = '';

  const heading = document.createElement('h2');
  heading.textContent = 'Bauhof – Verfügbare Gebäude';

  const msgEl = document.createElement('p');
  msgEl.id = 'build-message';
  msgEl.style.color = '#7cc8ff';
  msgEl.textContent = bauhofState.message;

  container.append(heading, msgEl);

  const { types, buildings, queue, selectedCategory } = bauhofState;

  const grid = document.createElement('div');
  grid.className = 'category-grid';

  const sectionTitle = document.createElement('h3');

  if (!selectedCategory) {
    sectionTitle.textContent = 'Rubriken';
    container.appendChild(sectionTitle);

    CATEGORIES.forEach(({ key, title, description, image }) => {
      const catBuildings = types.filter(t => t.category === key && t.name !== 'Rathaus');
      if (catBuildings.length === 0) return;

      const card = document.createElement('article');
      card.className = 'category-card';

      if (image) {
        const img = document.createElement('img');
        img.src = image;
        img.alt = `${title} Vorschau`;
        img.className = 'category-image';
        card.appendChild(img);
      }

      const h = document.createElement('h3');
      h.textContent = title;

      const desc = document.createElement('p');
      desc.textContent = description;

      const count = document.createElement('p');
      count.className = 'category-count';
      count.textContent = `${catBuildings.length} Gebäude verfügbar`;

      const openBtn = document.createElement('button');
      openBtn.className = 'primary-action';
      openBtn.textContent = 'Rubrik öffnen';
      openBtn.addEventListener('click', () => {
        changeCategory(key);
      });

      card.append(h, desc, count, openBtn);
      grid.appendChild(card);
    });

    container.appendChild(grid);
    return;
  }

  const selectedDefinition = CATEGORIES.find(c => c.key === selectedCategory);
  sectionTitle.textContent = selectedDefinition
    ? `Rubrik: ${selectedDefinition.title}`
    : 'Rubrik';
  container.appendChild(sectionTitle);

  const backBtn = document.createElement('button');
  backBtn.className = 'secondary-action';
  backBtn.textContent = 'Zurück zu Rubriken';
  backBtn.addEventListener('click', () => {
    changeCategory(null);
  });
  container.appendChild(backBtn);

  CATEGORIES.forEach(({ key, title, description, image }) => {
    if (key !== selectedCategory) return;

    const catBuildings = types.filter(t => t.category === key && t.name !== 'Rathaus');
    if (catBuildings.length === 0) return;

    const card = document.createElement('article');
    card.className = 'category-card';

    if (image) {
      const img = document.createElement('img');
      img.src = image;
      img.alt = `${title} Vorschau`;
      img.className = 'category-image';
      card.appendChild(img);
    }

    const h = document.createElement('h3');
    h.textContent = title;

    const desc = document.createElement('p');
    desc.textContent = description;

    card.append(h, desc);

    catBuildings.forEach(bt => {
      const owned = buildings.find(b => Number(b.id) === Number(bt.id));
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
            bauhofState.message = result.message ?? '';
            input.value = '1';
            const updated = await apiFetch('/buildings/me');
            bauhofState.buildings = updated.buildings ?? [];
            bauhofState.queue = updated.queue ?? [];
            await initShell();
            renderCategories(container);
            syncSidebarCategorySelection();
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

function attachSidebarCategoryInterception() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar || sidebar.dataset.bauhofInterceptAttached === 'true') return;

  sidebar.dataset.bauhofInterceptAttached = 'true';
  sidebar.addEventListener('click', (event) => {
    const anchor = event.target.closest('a');
    if (!anchor) return;

    const url = new URL(anchor.href, window.location.origin);
    if (url.pathname.toLowerCase() !== '/bauhof.html') return;

    event.preventDefault();
    const nextCategory = url.searchParams.get('category');
    changeCategory(nextCategory);
  });
}

// ── Hauptlogik ────────────────────────────────────────────
async function init() {
  const container = document.getElementById('Bauhof');
  if (!container) return;

  await initShell();
  attachSidebarCategoryInterception();

  container.innerHTML = '';

  try {
    const [buildData, types] = await Promise.all([
      apiFetch('/buildings/me'),
      apiFetch('/buildings/types'),
    ]);

    bauhofState.buildings = buildData.buildings ?? [];
    bauhofState.queue = buildData.queue ?? [];
    bauhofState.types = types;
    bauhofState.selectedCategory = getSelectedCategory();

    renderCategories(container);
    syncSidebarCategorySelection();
  } catch (err) {
    console.error(err);
    const errMsg = document.createElement('p');
    errMsg.textContent = `Fehler beim Laden: ${err.message}`;
    errMsg.style.color = '#f88';
    container.appendChild(errMsg);
  }
}

window.addEventListener('popstate', () => {
  bauhofState.selectedCategory = getSelectedCategory();
  renderCategories(document.getElementById('Bauhof'));
  syncSidebarCategorySelection();
});

init();

