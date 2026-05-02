// Gemeinsames Layout-Modul für alle Spielseiten (außer Login)
// Exportiert: initShell(), getAuth()

const API_BASE_URL = 'http://localhost:3000';

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

  const defaultLinks = [
    { label: 'Dashboard', href: '/dashboard.html' },
    { label: 'Bauhof',    href: '/bauhof.html'   },
  ];

  const links = defaultLinks.concat(
    navLinks.filter(nl => !defaultLinks.some(dl => dl.href === nl.href))
  );

  links.forEach(({ label, href }) => {
    const a = document.createElement('a');
    a.textContent = label;
    a.href = href;
    if (window.location.pathname.toLowerCase() === href.toLowerCase()) {
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

  const res = status.resources ?? {};
  const strom = status.strom ?? { frei: 0 };
  const bevoelkerung = status.bevoelkerung ?? 0;

  const items = [
    { key: 'geld',       label: '💰', value: Number(res.geld       ?? 0) },
    { key: 'stein',      label: '🪨', value: Number(res.stein      ?? 0) },
    { key: 'eisen',      label: '⚙️', value: Number(res.eisen      ?? 0) },
    { key: 'treibstoff', label: '🛢️', value: Number(res.treibstoff ?? 0) },
    { key: 'strom',      label: '⚡', value: strom.frei },
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

  const prod = status.production ?? {};

  const heading = document.createElement('h3');
  heading.textContent = 'Produktion / Tick';
  panel.appendChild(heading);

  const rows = [
    { label: '💰 Geld',       key: 'geld'       },
    { label: '🪨 Stein',      key: 'stein'      },
    { label: '⚙️ Eisen',      key: 'eisen'      },
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


