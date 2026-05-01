const raw = sessionStorage.getItem('currentUser');
const token = sessionStorage.getItem('authToken');

if (!raw || !token) {
  window.location.href = '/';
}

const currentUser = JSON.parse(raw);

// ── Navigation ────────────────────────────────────────────
const sidebar = document.getElementById('sidebar');

const navLinks = [
  { label: 'Dashboard', href: '/dashboard.html' },
];

navLinks.forEach(({ label, href }) => {
  const a = document.createElement('a');
  a.textContent = label;
  a.href = href;
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

// ── Ressourcen-Bar ────────────────────────────────────────
const resourceBar = document.getElementById('resource-bar');

const resources = [
  { name: 'Holz', amount: 0 },
  { name: 'Stein', amount: 0 },
  { name: 'Nahrung', amount: 0 },
  { name: 'Gold', amount: 0 },
];

resources.forEach(res => {
  const item = document.createElement('div');
  item.className = 'resource-item';
  item.dataset.resource = res.name;
  item.textContent = `${res.name}: ${res.amount}`;
  resourceBar.appendChild(item);
});

// ── Produktions-Panel ─────────────────────────────────────
const productionPanel = document.getElementById('production-panel');

const prodHeading = document.createElement('h3');
prodHeading.textContent = 'Produktion / h';
productionPanel.appendChild(prodHeading);

resources.forEach(res => {
  const item = document.createElement('div');
  item.className = 'production-item';
  item.innerHTML = '';

  const name = document.createElement('span');
  name.textContent = res.name;

  const rate = document.createElement('span');
  rate.textContent = '+0';
  rate.dataset.productionFor = res.name;

  item.appendChild(name);
  item.appendChild(rate);
  productionPanel.appendChild(item);
});

// ── Dashboard-Inhalt ──────────────────────────────────────
const container = document.getElementById('Dashboard');

const heading = document.createElement('h2');
heading.textContent = `Willkommen, ${currentUser.username}!`;

const role = document.createElement('p');
role.textContent = `Rolle: ${currentUser.role}`;

container.append(heading, role);

