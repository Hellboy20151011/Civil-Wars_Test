// Gemeinsames Layout-Modul für alle Spielseiten (außer Login)
// Exportiert: initShell()

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
  await renderResourceBar(auth.token);
  renderProductionPanel();
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

async function renderResourceBar(token) {
  const bar = document.getElementById('resource-bar');
  if (!bar) return;

  try {
    const res = await fetch(`${API_BASE_URL}/resources/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) throw new Error('Ressourcen konnten nicht geladen werden');

    const { resources } = await res.json();

    resources.forEach(({ name, amount }) => {
      const item = document.createElement('div');
      item.className = 'resource-item';
      item.dataset.resource = name;

      const label = document.createElement('span');
      label.textContent = `${name}: `;

      const value = document.createElement('span');
      value.textContent = amount.toLocaleString('de-DE');
      value.dataset.resourceValue = name;

      item.append(label, value);
      bar.appendChild(item);
    });

  } catch (err) {
    console.error(err);
    const fallback = document.createElement('span');
    fallback.textContent = 'Ressourcen nicht verfügbar';
    fallback.style.color = '#f88';
    bar.appendChild(fallback);
  }
}

function renderProductionPanel() {
  const panel = document.getElementById('production-panel');
  if (!panel) return;

  const heading = document.createElement('h3');
  heading.textContent = 'Produktion / h';
  panel.appendChild(heading);

  const resourceNames = ['Stein', 'Metall', 'Geld'];

  resourceNames.forEach(name => {
    const item = document.createElement('div');
    item.className = 'production-item';

    const nameSpan = document.createElement('span');
    nameSpan.textContent = name;

    const rate = document.createElement('span');
    rate.textContent = '+0';
    rate.dataset.productionFor = name;

    item.append(nameSpan, rate);
    panel.appendChild(item);
  });
}
