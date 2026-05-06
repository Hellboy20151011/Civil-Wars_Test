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
];

const BUILDING_IMAGE_BY_NAME = {
  Wohnhaus: '/assets/images/categories/unterkünfte.jpg',
  Reihenhaus: '/assets/images/categories/unterkünfte.jpg',
  Mehrfamilienhaus: '/assets/images/categories/unterkünfte.jpg',
  Hochhaus: '/assets/images/categories/unterkünfte.jpg',
  Kraftwerk: '/assets/images/buildings/kraftwerk.jpg',
  Stahlwerk: '/assets/images/buildings/stahlwerk.jpg',
  Steinbruch: '/assets/images/buildings/steinbruch.jpg',
  Ölpumpe: '/assets/images/buildings/ölpumpe.jpg',
  'Öl-Raffinerie': '/assets/images/buildings/ölraffinerie.jpg',
  Ölraffinerie: '/assets/images/buildings/ölraffinerie.jpg',
};

const bauhofState = {
  selectedCategory: null,
  types: [],
  buildings: [],
  queue: [],
  highlightMaxForBuildingId: null,
  playerStatus: {
    resources: {},
    strom: { frei: 0 },
  },
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
    cache: 'no-store',
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

function getPlayerResources() {
  return bauhofState.playerStatus?.resources ?? {};
}

function getFreePower() {
  return Number(bauhofState.playerStatus?.strom?.frei ?? 0);
}

function formatMaxBuildable(value) {
  return Number.isFinite(value) ? value.toLocaleString('de-DE') : '∞';
}

// Spezielle Obergrenzen durch Gebäude-Ratio-Regeln (z. B. 5 Öl-Raffinerien pro Ölpumpe)
const BUILDING_RATIO_CAPS = [
  {
    building: 'Öl-Raffinerie',
    requires: 'Ölpumpe',
    ratio: 5,
  },
];

function getBuiltCount(name) {
  const entry = bauhofState.buildings.find((b) => b.name === name);
  return entry ? Number(entry.anzahl ?? 0) : 0;
}

function getRatioCap(bt) {
  const rule = BUILDING_RATIO_CAPS.find((r) => r.building === bt.name);
  if (!rule) return Infinity;
  const providerCount = getBuiltCount(rule.requires);
  const currentCount = getBuiltCount(bt.name);
  return Math.max(0, providerCount * rule.ratio - currentCount);
}

function getMaxBuildableByResourcesAndPower(bt) {
  const resources = getPlayerResources();
  const limits = [];

  const resourceChecks = [
    { available: Number(resources.geld ?? 0), cost: Number(bt.money_cost ?? 0) },
    { available: Number(resources.stein ?? 0), cost: Number(bt.stone_cost ?? 0) },
    { available: Number(resources.stahl ?? 0), cost: Number(bt.steel_cost ?? 0) },
    { available: Number(resources.treibstoff ?? 0), cost: Number(bt.fuel_cost ?? 0) },
  ];

  resourceChecks.forEach(({ available, cost }) => {
    if (cost > 0) {
      limits.push(Math.floor(available / cost));
    }
  });

  const powerCost = Number(bt.power_consumption ?? 0);
  if (powerCost > 0) {
    limits.push(Math.floor(getFreePower() / powerCost));
  }

  const ratioCap = getRatioCap(bt);
  if (Number.isFinite(ratioCap)) {
    limits.push(ratioCap);
  }

  if (limits.length === 0) return Infinity;
  return Math.max(0, Math.min(...limits));
}

function getBuildingImage(bt, category) {
  return BUILDING_IMAGE_BY_NAME[bt.name] || category?.image || '/assets/images/categories/unterkünfte.jpg';
}

function applyLocalBuildCost(bt, quantity) {
  const current = bauhofState.playerStatus ?? { resources: {}, strom: { frei: 0 } };
  const resources = { ...(current.resources ?? {}) };
  const strom = { ...(current.strom ?? { frei: 0 }) };

  resources.geld = Math.max(0, Number(resources.geld ?? 0) - Number(bt.money_cost ?? 0) * quantity);
  resources.stein = Math.max(0, Number(resources.stein ?? 0) - Number(bt.stone_cost ?? 0) * quantity);
  resources.stahl = Math.max(0, Number(resources.stahl ?? 0) - Number(bt.steel_cost ?? 0) * quantity);
  resources.treibstoff = Math.max(
    0,
    Number(resources.treibstoff ?? 0) - Number(bt.fuel_cost ?? 0) * quantity
  );

  strom.frei = Math.max(0, Number(strom.frei ?? 0) - Number(bt.power_consumption ?? 0) * quantity);

  bauhofState.playerStatus = {
    ...current,
    resources,
    strom,
  };

  // Gebäudezähler lokal aktualisieren, damit Ratio-Caps sofort stimmen
  const existingEntry = bauhofState.buildings.find((b) => b.name === bt.name);
  if (existingEntry) {
    existingEntry.anzahl = Number(existingEntry.anzahl ?? 0) + quantity;
  } else {
    bauhofState.buildings = [...bauhofState.buildings, { ...bt, anzahl: quantity }];
  }
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

function buildBuildingCard(bt, category, container) {
  const owned = bauhofState.buildings.find((b) => Number(b.id) === Number(bt.id));
  const existingCount = Number(owned?.anzahl ?? 0);
  const inQueue = bauhofState.queue.find((q) => q.building_type_id === bt.id);
  const maxBuildable = getMaxBuildableByResourcesAndPower(bt);
  const maxBuildableLabel = formatMaxBuildable(maxBuildable);
  const numericMax = Number.isFinite(maxBuildable) ? Math.max(0, maxBuildable) : 999;
  const unavailable = numericMax === 0;
  const powerCost = Number(bt.power_consumption ?? 0);

  const input = el('input', {
    className: 'build-quantity-input',
    attrs: {
      type: 'number',
      min: '1',
      max: String(Math.max(1, numericMax)),
      value: '1',
      placeholder: 'Anzahl',
    },
  });

  const button = el('button', {
    className: 'primary-action',
    text: 'Bauen',
    dataset: { buildId: bt.id },
    attrs: { disabled: inQueue || unavailable ? 'true' : null },
    on: {
      click: async () => {
        button.disabled = true;
        input.disabled = true;

        try {
          if (numericMax <= 0) {
            bauhofState.message = 'Nicht genügend Ressourcen oder Strom für dieses Gebäude.';
            renderCategories(container);
            syncSidebarCategorySelection();
            return;
          }

          const quantity = Math.max(1, Math.min(numericMax, Number(input.value) || 1));
          const result = await apiFetch('/buildings/build', {
            method: 'POST',
            body: JSON.stringify({ building_type_id: bt.id, anzahl: quantity }),
          });

          bauhofState.message = result.message ?? '';
          applyLocalBuildCost(bt, quantity);

          const updated = await apiFetch('/buildings/me');
          bauhofState.buildings = updated.buildings ?? [];
          bauhofState.queue = updated.queue ?? [];
          bauhofState.highlightMaxForBuildingId = bt.id;

          try {
            const status = await apiFetch('/me');
            bauhofState.playerStatus = status;
          } catch {
            // Lokale Aktualisierung bleibt bestehen, wenn /me temporär nicht antwortet.
          }

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

  const maxBuildableControl = el('button', {
    className: `max-buildable-link${bauhofState.highlightMaxForBuildingId === bt.id ? ' max-buildable-link--flash' : ''}`,
    text: `(${maxBuildableLabel})`,
    attrs: {
      type: 'button',
      title: 'Maximalen Wert in das Anzahlfeld übernehmen',
      disabled: unavailable ? 'true' : null,
    },
    on: {
      click: () => {
        if (numericMax <= 0) return;
        input.value = String(numericMax);
      },
    },
  });

  if (inQueue) {
    input.disabled = true;
  }

  if (unavailable) {
    input.disabled = true;
  }

  return el('article', {
    className: 'building-card',
    children: [
      el('img', {
        className: 'building-card-image',
        attrs: {
          src: getBuildingImage(bt, category),
          alt: `${bt.name} Gebäude`,
        },
      }),
      el('h4', { text: bt.name }),
      el('p', {
        className: 'building-card-description',
        text: bt.description || 'Keine Beschreibung verfügbar.',
      }),
      el('span', {
        className: 'building-count',
        text: `Vorhanden: ${existingCount.toLocaleString('de-DE')}`,
      }),
      el('span', {
        className: 'build-cost',
        text: getBuildCostsText(bt),
      }),
      el('span', {
        className: 'build-power',
        text: `⚡ ${powerCost.toLocaleString('de-DE')} (max ${maxBuildableLabel})`,
      }),
      el('div', {
        className: 'building-card-actions',
        children: [input, maxBuildableControl, button],
      }),
    ],
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

    catBuildings.forEach((bt) => {
      gridChildren.push(buildBuildingCard(bt, category, container));
    });
  });

  nodes.push(el('div', { className: 'category-grid', children: gridChildren }));
  render(container, nodes);

  if (bauhofState.highlightMaxForBuildingId !== null) {
    setTimeout(() => {
      bauhofState.highlightMaxForBuildingId = null;
    }, 0);
  }
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
    const [buildData, types, status] = await Promise.all([
      apiFetch('/buildings/me'),
      apiFetch('/buildings/types'),
      apiFetch('/me'),
    ]);

    bauhofState.buildings = buildData.buildings ?? [];
    bauhofState.queue = buildData.queue ?? [];
    bauhofState.types = types;
    bauhofState.playerStatus = status;
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

