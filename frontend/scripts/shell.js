// Gemeinsames Layout-Modul für alle Spielseiten (außer Login)
// Exportiert: initShell(), getAuth()

const API_BASE_URL = 'http://localhost:3000';

const BAUHOF_CATEGORIES = [
  { key: 'housing', label: 'Unterkünfte' },
  { key: 'infrastructure', label: 'Industrie' },
  { key: 'military', label: 'Militär' },
  { key: 'government', label: 'Regierung' },
  { key: 'defense', label: 'Verteidigung' },
];

const MILITAER_CATEGORIES = [
  { key: 'infantry',  label: 'Infanterie'  },
  { key: 'vehicle',   label: 'Fahrzeuge'   },
  { key: 'ship',      label: 'Marine'      },
  { key: 'air',       label: 'Luftwaffe'   },
  { key: 'spionage',  label: 'Spionage'    },
  { key: 'defense',   label: 'Verteidigung' },
];

export function getAuth() {
  const raw = sessionStorage.getItem('currentUser');
  const token = sessionStorage.getItem('authToken');
  if (!raw || !token || token === 'undefined' || token === 'null') {
    sessionStorage.removeItem('currentUser');
    sessionStorage.removeItem('authToken');
    window.location.href = '/';
    return null;
  }
  return { user: JSON.parse(raw), token };
}

export async function initShell(navLinks = []) {
  const auth = getAuth();
  if (!auth) return;

  renderSidebar(navLinks, auth);

  // /me lädt Ressourcen, Strom, Produktion und Gebäude in einem Request
  try {
    const res = await fetch(`${API_BASE_URL}/me`, {
      headers: { Authorization: `Bearer ${auth.token}` }
    });
    if (!res.ok) throw new Error('Status-Abruf fehlgeschlagen');
    const status = await res.json();
    renderResourceBar(status);
    renderProductionPanel(status);
  } catch (err) {
    console.error(err);
    const bar = document.getElementById('resource-bar');
    if (bar) {
      const fallback = document.createElement('span');
      fallback.textContent = 'Ressourcen nicht verfügbar';
      fallback.style.color = '#f88';
      bar.appendChild(fallback);
    }
  }
}

function renderSidebar(navLinks, auth) {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;

  sidebar.innerHTML = '';
  const isBauhofPage   = window.location.pathname.toLowerCase() === '/bauhof.html';
  const isMilitaerPage = window.location.pathname.toLowerCase() === '/militaer.html';
  const currentCategory = new URLSearchParams(window.location.search).get('category');

  const defaultLinks = [
    { label: 'Dashboard', href: '/dashboard.html' },
    { label: 'Bauhof',    href: '/bauhof.html'   },
    { label: 'Militär',   href: '/militaer.html' },
  ];

  const links = defaultLinks.concat(
    navLinks.filter(nl => !defaultLinks.some(dl => dl.href === nl.href))
  );

  links.forEach(({ label, href }) => {
    const hrefLower = href.toLowerCase();

    if (hrefLower === '/bauhof.html') {
      const group = document.createElement('div');
      group.className = 'nav-group';

      const bauhofLink = document.createElement('a');
      bauhofLink.textContent = label;
      bauhofLink.href = href;
      if (isBauhofPage) bauhofLink.classList.add('is-active');
      group.appendChild(bauhofLink);

      if (isBauhofPage) {
        const submenu = document.createElement('div');
        submenu.className = 'nav-submenu';
        BAUHOF_CATEGORIES.forEach(({ key, label: categoryLabel }) => {
          const subLink = document.createElement('a');
          subLink.className = 'submenu-link';
          subLink.textContent = categoryLabel;
          subLink.href = `/bauhof.html?category=${key}`;
          if (currentCategory === key) subLink.classList.add('is-active');
          submenu.appendChild(subLink);
        });
        group.appendChild(submenu);
      }

      sidebar.appendChild(group);
      return;
    }

    if (hrefLower === '/militaer.html') {
      const group = document.createElement('div');
      group.className = 'nav-group';

      const militaerLink = document.createElement('a');
      militaerLink.textContent = label;
      militaerLink.href = href;
      if (isMilitaerPage) militaerLink.classList.add('is-active');
      group.appendChild(militaerLink);

      if (isMilitaerPage) {
        const submenu = document.createElement('div');
        submenu.className = 'nav-submenu';
        MILITAER_CATEGORIES.forEach(({ key, label: categoryLabel }) => {
          const subLink = document.createElement('a');
          subLink.className = 'submenu-link';
          subLink.textContent = categoryLabel;
          subLink.href = `/militaer.html?category=${key}`;
          if (currentCategory === key) subLink.classList.add('is-active');
          submenu.appendChild(subLink);
        });
        group.appendChild(submenu);
      }

      sidebar.appendChild(group);
      return;
    }

    const a = document.createElement('a');
    a.textContent = label;
    a.href = href;
    if (window.location.pathname.toLowerCase() === hrefLower) {
      a.classList.add('is-active');
    }
    sidebar.appendChild(a);
  });

  const logoutBtn = document.createElement('button');
  logoutBtn.textContent = 'Logout';
  logoutBtn.style.marginTop = 'auto';
  logoutBtn.addEventListener('click', () => {
    sessionStorage.removeItem('currentUser');
    sessionStorage.removeItem('authToken');
    window.location.href = '/';
  });
  sidebar.appendChild(logoutBtn);
}

function renderResourceBar(status) {
  const bar = document.getElementById('resource-bar');
  if (!bar) return;

  bar.innerHTML = '';

  const res = status.resources ?? {};
  const strom = status.strom ?? { frei: 0 };
  const bevoelkerung = status.bevoelkerung ?? 0;

  const items = [
    { key: 'geld',       label: '💰', value: Number(res.geld       ?? 0) },
    { key: 'stein',      label: '🪨', value: Number(res.stein      ?? 0) },
    { key: 'stahl',      label: '⚙️', value: Number(res.stahl      ?? 0) },
    { key: 'treibstoff', label: '🛢️', value: Number(res.treibstoff ?? 0) },
    { key: 'strom',      label: '⚡', value: Number(strom.frei ?? 0) },
    { key: 'bevoelkerung', label: '👥', value: bevoelkerung },
  ];

  items.forEach(({ key, label, value }) => {
    const item = document.createElement('div');
    item.className = 'resource-item';
    item.dataset.resource = key;

    const icon = document.createElement('span');
    icon.textContent = label;
    icon.style.marginRight = '3px';

    const val = document.createElement('span');
    val.textContent = value.toLocaleString('de-DE');
    val.dataset.resourceValue = key;

    item.append(icon, val);
    bar.appendChild(item);
  });
}

function renderProductionPanel(status) {
  const panel = document.getElementById('production-panel');
  if (!panel) return;

  panel.innerHTML = '';

  const prod = status.production ?? {};

  const heading = document.createElement('h3');
  heading.textContent = 'Produktion / Tick';
  panel.appendChild(heading);

  const rows = [
    { label: '💰 Geld',       key: 'geld'       },
    { label: '🪨 Stein',      key: 'stein'      },
    { label: '⚙️ Stahl',      key: 'stahl'      },
    { label: '🛢️ Treibstoff', key: 'treibstoff' },
  ];

  rows.forEach(({ label, key }) => {
    const item = document.createElement('div');
    item.className = 'production-item';

    const nameSpan = document.createElement('span');
    nameSpan.textContent = label;

    const rate = document.createElement('span');
    const val = Number(prod[key] ?? 0);
    rate.textContent = val > 0 ? `+${val.toLocaleString('de-DE')}` : '+0';
    rate.dataset.productionFor = key;

    item.append(nameSpan, rate);
    panel.appendChild(item);
  });
}


