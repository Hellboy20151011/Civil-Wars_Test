import { initShell, getAuth } from '/scripts/shell.js';
import { API_BASE_URL } from '/scripts/config.js';
import { el, render } from '/scripts/ui/component.js';

const auth = getAuth();
if (!auth) throw new Error('Nicht eingeloggt');

const UNIT_CATEGORIES = [
  {
    key: 'infantry',
    title: 'Infanterie',
    description: 'Bodeneinheiten – Soldaten, Panzergrenadiere und Spezialisten.',
    image: '/assets/images/categories/militär.jpg',
  },
  {
    key: 'vehicle',
    title: 'Fahrzeuge',
    description: 'Gepanzerte Fahrzeuge und Artillerie.',
    image: '/assets/images/categories/militär.jpg',
  },
  {
    key: 'ship',
    title: 'Marine',
    description: 'Kriegsschiffe und Marineeinheiten.',
    image: '/assets/images/categories/militär.jpg',
  },
  {
    key: 'air',
    title: 'Luftwaffe',
    description: 'Kampfflugzeuge, Bomber und Luftabwehr.',
    image: '/assets/images/categories/militär.jpg',
  },
  {
    key: 'defense',
    title: 'Verteidigung',
    description: 'Stationäre Verteidigungsanlagen.',
    image: '/assets/images/categories/militär.jpg',
  },
];

const militaerState = {
  selectedCategory: null,
  unitTypes: [],
  myUnits: [],
  buildings: [],
  researchLabLevel: 0,
  defenseResearchLevel: 0,
  activeResearch: null,
  message: '',
};

function getDefenseResearchRequirement(unitType) {
  const match = String(unitType.building_requirement ?? '').match(/Level\s*(\d+)/i);
  const parsed = Number(match?.[1] ?? 1);
  if (!Number.isFinite(parsed)) return 1;
  return Math.min(3, Math.max(1, parsed));
}

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
    const currentPath = url.pathname.toLowerCase();
    if (currentPath !== '/militaer.html' && currentPath !== '/pages/militaer.html') return;
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

function getUnitCostsText(unitType) {
  const costs = [];
  if (unitType.money_cost > 0) costs.push(`💰 ${Number(unitType.money_cost).toLocaleString('de-DE')}`);
  if (unitType.steel_cost > 0) costs.push(`⚙️ ${Number(unitType.steel_cost).toLocaleString('de-DE')}`);
  if (unitType.fuel_cost > 0) costs.push(`🛢️ ${Number(unitType.fuel_cost).toLocaleString('de-DE')}`);
  return costs.length > 0 ? costs.join('  ') : 'Kostenlos';
}

function buildOverviewCategoryCard(category, unitCount) {
  return el('article', {
    className: 'category-card',
    children: [
      el('h3', { text: category.title }),
      el('p', { text: category.description }),
      el('p', {
        className: 'category-count',
        text: `${unitCount} Einheitentypen verfügbar`,
      }),
      el('button', {
        className: 'primary-action',
        text: 'Kategorie öffnen',
        on: {
          click: () => changeCategory(category.key),
        },
      }),
    ],
  });
}

function getBuiltRequirementCount(buildingName) {
  const building = militaerState.buildings.find((b) => b.name === buildingName);
  return Number(building?.anzahl ?? 0);
}

function buildUnitCard(unitType, category, container) {
  const owned = militaerState.myUnits.find(
    (u) => u.unit_type_id === unitType.id || u.name === unitType.name
  );
  const ownedCount = Number(owned?.quantity ?? 0);
  const isDefenseUnit = unitType.category === 'defense';
  const requiredBuildingCount = getBuiltRequirementCount(unitType.building_requirement);
  const requiredResearchLevel = isDefenseUnit ? getDefenseResearchRequirement(unitType) : 0;
  const canTrain = isDefenseUnit
    ? militaerState.defenseResearchLevel >= requiredResearchLevel
    : requiredBuildingCount > 0;
  const requirementLabel = isDefenseUnit
    ? `Forschung: Verteidigungsforschung Level ${requiredResearchLevel} (aktuell ${militaerState.defenseResearchLevel})`
    : `Benötigt: ${unitType.building_requirement} (${requiredBuildingCount.toLocaleString('de-DE')})`;
  const lockHintText = isDefenseUnit
    ? 'Wird über Forschung freigeschaltet'
    : 'Gebäude noch nicht gebaut';

  const input = el('input', {
    className: 'build-quantity-input',
    attrs: {
      type: 'number',
      min: '1',
      max: '999',
      value: '1',
      style: 'width:68px',
      disabled: canTrain ? null : 'true',
    },
  });

  const button = el('button', {
    className: 'primary-action',
    text: 'Ausbilden',
    attrs: { disabled: canTrain ? null : 'true' },
    on: {
      click: async () => {
        button.disabled = true;
        input.disabled = true;

        try {
          const quantity = Math.max(1, Math.min(999, Number(input.value) || 1));
          const result = await apiFetch('/units/train', {
            method: 'POST',
            body: JSON.stringify({ unit_type_id: unitType.id, quantity }),
          });

          militaerState.message = result.message ?? '';
          const [myUnits, buildData, researchOverview] = await Promise.all([
            apiFetch('/units/me'),
            apiFetch('/buildings/me'),
            apiFetch('/research/overview'),
          ]);
          militaerState.myUnits = myUnits;
          militaerState.buildings = buildData.buildings ?? [];
          militaerState.researchLabLevel = Number(researchOverview?.researchLabLevel ?? 0);
          militaerState.defenseResearchLevel = Number(researchOverview?.defenseResearchLevel ?? 0);
          militaerState.activeResearch = researchOverview?.activeResearch ?? null;
          await initShell();

          renderMilitaer(container);
          syncSidebarCategorySelection();
        } catch (err) {
          militaerState.message = err.message;
          renderMilitaer(container);
          syncSidebarCategorySelection();
        }
      },
    },
  });

  return el('article', {
    className: `building-card${canTrain ? '' : ' is-locked'}`,
    children: [
      el('img', {
        className: 'building-card-image',
        attrs: {
          src: category?.image || '/assets/images/categories/militär.jpg',
          alt: `${unitType.name} Einheit`,
        },
      }),
      el('h4', { text: unitType.name }),
      !canTrain
        ? el('span', {
          className: 'unit-lock-badge',
          text: 'Gesperrt',
        })
        : null,
      el('p', {
        className: 'building-card-description',
        text: unitType.description || 'Militäreinheit für taktische Einsätze.',
      }),
      el('span', {
        className: 'building-count',
        text: `Vorhanden: ${ownedCount.toLocaleString('de-DE')}`,
      }),
      el('span', {
        className: `build-cost unit-requirement${canTrain ? '' : ' unit-requirement--missing'}`,
        text: requirementLabel,
      }),
      el('span', {
        className: 'build-cost',
        text: getUnitCostsText(unitType),
      }),
      el('span', {
        className: 'build-power',
        text: `HP: ${unitType.hitpoints}  ⚔️ ${unitType.attack_points}  🛡️ ${unitType.defense_points}`,
      }),
      !canTrain
        ? el('span', {
          className: 'unit-lock-hint',
          text: lockHintText,
        })
        : null,
      el('div', {
        className: 'building-card-actions',
        children: [input, button],
      }),
    ],
  });
}

function renderMilitaer(container) {
  if (!container) return;

  const defenseUnlockText = militaerState.defenseResearchLevel >= 3
    ? 'Alle Verteidigungsstellungen freigeschaltet'
    : `Verteidigung freigeschaltet bis Level ${militaerState.defenseResearchLevel}`;
  const activeResearchText = militaerState.activeResearch
    ? `Aktive Forschung: ${militaerState.activeResearch.name}`
    : 'Keine aktive Forschung';

  const nodes = [
    el('h2', { text: 'Militär – Einheiten ausbilden' }),
    el('p', {
      attrs: { id: 'mil-message' },
      className: 'dash-message',
      text: militaerState.message,
    }),
    el('p', {
      className: 'gdh-level-info',
      text: `Forschungslabor Level ${militaerState.researchLabLevel} – ${defenseUnlockText} – ${activeResearchText}`,
    }),
  ];

  const { unitTypes, selectedCategory } = militaerState;
  const gridChildren = [];

  if (!selectedCategory) {
    nodes.push(el('h3', { text: 'Einheitenkategorien' }));

    UNIT_CATEGORIES.forEach(({ key, title, description }) => {
      const catUnits = unitTypes.filter((u) => u.category === key);
      if (catUnits.length === 0) return;

      gridChildren.push(
        buildOverviewCategoryCard({ key, title, description }, catUnits.length)
      );
    });

    nodes.push(el('div', { className: 'category-grid', children: gridChildren }));
    render(container, nodes);
    return;
  }

  const selectedDef = UNIT_CATEGORIES.find((c) => c.key === selectedCategory);
  nodes.push(
    el('h3', {
      text: selectedDef ? `Kategorie: ${selectedDef.title}` : 'Kategorie',
    }),
    el('button', {
      className: 'secondary-action',
      text: 'Zurück zur Übersicht',
      on: {
        click: () => changeCategory(null),
      },
    })
  );

  const catUnits = unitTypes.filter((u) => u.category === selectedCategory);

  if (catUnits.length === 0) {
    nodes.push(el('p', { text: 'Keine Einheiten in dieser Kategorie verfügbar.' }));
    render(container, nodes);
    return;
  }

  catUnits.forEach((ut) => {
    gridChildren.push(buildUnitCard(ut, selectedDef, container));
  });

  nodes.push(el('div', { className: 'category-grid', children: gridChildren }));
  render(container, nodes);
}

function attachSidebarInterception() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar || sidebar.dataset.militaerInterceptAttached === 'true') return;

  sidebar.dataset.militaerInterceptAttached = 'true';
  sidebar.addEventListener('click', (event) => {
    const anchor = event.target.closest('a');
    if (!anchor) return;

    const url = new URL(anchor.href, window.location.origin);
    const targetPath = url.pathname.toLowerCase();
    if (targetPath !== '/militaer.html' && targetPath !== '/pages/militaer.html') return;

    event.preventDefault();
    changeCategory(url.searchParams.get('category'));
  });
}

async function init() {
  const container = document.getElementById('Militaer');
  if (!container) return;

  await initShell();
  attachSidebarInterception();

  try {
    const [unitTypes, myUnits, buildData, researchOverview] = await Promise.all([
      apiFetch('/units/types'),
      apiFetch('/units/me'),
      apiFetch('/buildings/me'),
      apiFetch('/research/overview'),
    ]);

    militaerState.unitTypes = unitTypes;
    militaerState.myUnits = myUnits;
    militaerState.buildings = buildData.buildings ?? [];
    militaerState.researchLabLevel = Number(researchOverview?.researchLabLevel ?? 0);
    militaerState.defenseResearchLevel = Number(researchOverview?.defenseResearchLevel ?? 0);
    militaerState.activeResearch = researchOverview?.activeResearch ?? null;
    militaerState.selectedCategory = getSelectedCategory();

    renderMilitaer(container);
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
  militaerState.selectedCategory = getSelectedCategory();
  renderMilitaer(document.getElementById('Militaer'));
  syncSidebarCategorySelection();
});

init();
