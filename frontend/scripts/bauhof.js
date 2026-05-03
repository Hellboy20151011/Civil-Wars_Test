import { initShell, getAuth } from '/scripts/shell.js';
import { API_BASE_URL } from '/scripts/config.js';
import { el, render } from '/scripts/ui/component.js';

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

function getBuildCostsText(bt) {
  const costs = [];
  if (bt.money_cost > 0) costs.push(`💰 ${Number(bt.money_cost).toLocaleString('de-DE')}`);
  if (bt.stone_cost > 0) costs.push(`🪨 ${Number(bt.stone_cost).toLocaleString('de-DE')}`);
  if (bt.steel_cost > 0) costs.push(`⚙️ ${Number(bt.steel_cost).toLocaleString('de-DE')}`);
  if (bt.fuel_cost > 0) costs.push(`🛢️ ${Number(bt.fuel_cost).toLocaleString('de-DE')}`);
  return costs.length > 0 ? costs.join('  ') : 'Kostenlos';
}

function buildCategoryOverviewCard(category, typesForCategory) {
  const { key, title, description, image } = category;
  const children = [];

  if (image) {
    children.push(
      el('img', {
        className: 'category-image',
        attrs: { src: image, alt: `${title} Vorschau` },
      })
    );
  }

  children.push(
    el('h3', { text: title }),
    el('p', { text: description }),
    el('p', {
      className: 'category-count',
      text: `${typesForCategory.length} Gebäude verfügbar`,
    }),
    el('button', {
      className: 'primary-action',
      text: 'Rubrik öffnen',
      on: {
        click: () => changeCategory(key),
      },
    })
  );

  return el('article', {
    className: 'category-card',
    children,
  });
}

function buildBuildingRow(bt, container) {
  const owned = bauhofState.buildings.find((b) => Number(b.id) === Number(bt.id));
  const inQueue = bauhofState.queue.find((q) => q.building_type_id === bt.id);

  const input = el('input', {
    className: 'build-quantity-input',
    attrs: {
      type: 'number',
      min: '1',
      max: '999',
      value: '1',
      placeholder: 'Anzahl',
      style: 'width:60px;padding:4px 6px;border-radius:3px;border:1px solid #aaa',
    },
  });

  const button = el('button', {
    className: 'primary-action',
    text: inQueue ? 'In Warteschlange…' : owned ? 'Weiteren bauen' : 'Bauen',
    dataset: { buildId: bt.id },
    attrs: { disabled: inQueue ? 'true' : null },
    on: {
      click: async () => {
        button.disabled = true;
        input.disabled = true;

        try {
          const quantity = Math.max(1, Math.min(999, Number(input.value) || 1));
          const result = await apiFetch('/buildings/build', {
            method: 'POST',
            body: JSON.stringify({ building_type_id: bt.id, anzahl: quantity }),
          });

          bauhofState.message = result.message ?? '';
          const updated = await apiFetch('/buildings/me');
          bauhofState.buildings = updated.buildings ?? [];
          bauhofState.queue = updated.queue ?? [];

          await initShell();
          renderCategories(container);
          syncSidebarCategorySelection();
        } catch (err) {
          bauhofState.message = err.message;
          renderCategories(container);
          syncSidebarCategorySelection();
        }
      },
    },
  });

  if (inQueue) {
    input.disabled = true;
  }

  return el('div', {
    className: 'building-type-row',
    children: [
      el('strong', { text: bt.name }),
      el('span', {
        className: 'build-cost',
        text: getBuildCostsText(bt),
      }),
      el('div', {
        attrs: { style: 'display:flex;gap:8px;align-items:center' },
        children: [input, button],
      }),
    ],
  });
}

function buildSelectedCategoryCard(category, catBuildings, container) {
  const children = [];

  if (category.image) {
    children.push(
      el('img', {
        className: 'category-image',
        attrs: { src: category.image, alt: `${category.title} Vorschau` },
      })
    );
  }

  children.push(el('h3', { text: category.title }), el('p', { text: category.description }));

  catBuildings.forEach((bt) => {
    children.push(buildBuildingRow(bt, container));
  });

  return el('article', {
    className: 'category-card',
    children,
  });
}

// ── Kategorien + Gebäudetypen ─────────────────────────────
function renderCategories(container) {
  if (!container) return;

  const nodes = [
    el('h2', { text: 'Bauhof – Verfügbare Gebäude' }),
    el('p', {
      attrs: { id: 'build-message', style: 'color:#7cc8ff' },
      text: bauhofState.message,
    }),
  ];

  const { types, selectedCategory } = bauhofState;

  const gridChildren = [];

  if (!selectedCategory) {
    nodes.push(el('h3', { text: 'Rubriken' }));

    CATEGORIES.forEach(({ key, title, description, image }) => {
      const catBuildings = types.filter((t) => t.category === key && t.name !== 'Rathaus');
      if (catBuildings.length === 0) return;

      gridChildren.push(
        buildCategoryOverviewCard({ key, title, description, image }, catBuildings)
      );
    });

    nodes.push(el('div', { className: 'category-grid', children: gridChildren }));
    render(container, nodes);
    return;
  }

  const selectedDefinition = CATEGORIES.find((c) => c.key === selectedCategory);
  nodes.push(
    el('h3', {
      text: selectedDefinition ? `Rubrik: ${selectedDefinition.title}` : 'Rubrik',
    }),
    el('button', {
      className: 'secondary-action',
      text: 'Zurück zu Rubriken',
      on: {
        click: () => changeCategory(null),
      },
    })
  );

  CATEGORIES.forEach((category) => {
    const { key } = category;
    if (key !== selectedCategory) return;

    const catBuildings = types.filter((t) => t.category === key && t.name !== 'Rathaus');
    if (catBuildings.length === 0) return;

    gridChildren.push(buildSelectedCategoryCard(category, catBuildings, container));
  });

  nodes.push(el('div', { className: 'category-grid', children: gridChildren }));
  render(container, nodes);
}

function attachSidebarCategoryInterception() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar || sidebar.dataset.bauhofInterceptAttached === 'true') return;

  sidebar.dataset.bauhofInterceptAttached = 'true';
  sidebar.addEventListener('click', (event) => {
    const anchor = event.target.closest('a');
    if (!anchor) return;

    const url = new URL(anchor.href, window.location.origin);
    const targetPath = url.pathname.toLowerCase();
    if (targetPath !== '/bauhof.html' && targetPath !== '/pages/bauhof.html') return;

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
    render(container, [
      el('p', {
        text: `Fehler beim Laden: ${err.message}`,
        attrs: { style: 'color:#f88' },
      }),
    ]);
  }
}

window.addEventListener('popstate', () => {
  bauhofState.selectedCategory = getSelectedCategory();
  renderCategories(document.getElementById('Bauhof'));
  syncSidebarCategorySelection();
});

init();

