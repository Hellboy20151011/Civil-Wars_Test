const raw = sessionStorage.getItem('currentUser');
const token = sessionStorage.getItem('authToken');

if (!raw || !token) {
  window.location.href = '/';
}

const currentUser = JSON.parse(raw);

function renderShell() {
  const sidebar = document.getElementById('sidebar');
  const resourceBar = document.getElementById('resource-bar');
  const productionPanel = document.getElementById('production-panel');

  const navLinks = [
    { label: 'Dashboard', href: '/dashboard.html' },
    { label: 'Bauhof', href: '/bauhof.html' }
  ];

  navLinks.forEach(({ label, href }) => {
    const link = document.createElement('a');
    link.textContent = label;
    link.href = href;
    if (window.location.pathname.toLowerCase() === href.toLowerCase()) {
      link.classList.add('is-active');
    }
    sidebar.appendChild(link);
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

  const resources = [
    { name: 'Holz', amount: 0 },
    { name: 'Stein', amount: 0 },
    { name: 'Nahrung', amount: 0 },
    { name: 'Gold', amount: 0 }
  ];

  resources.forEach((res) => {
    const item = document.createElement('div');
    item.className = 'resource-item';
    item.textContent = `${res.name}: ${res.amount}`;
    resourceBar.appendChild(item);
  });

  const prodHeading = document.createElement('h3');
  prodHeading.textContent = 'Produktion / h';
  productionPanel.appendChild(prodHeading);

  resources.forEach((res) => {
    const item = document.createElement('div');
    item.className = 'production-item';

    const name = document.createElement('span');
    name.textContent = res.name;

    const rate = document.createElement('span');
    rate.textContent = '+0';

    item.append(name, rate);
    productionPanel.appendChild(item);
  });
}

function renderTownHallBuild(container, onBuilt) {
  container.innerHTML = '';

  const title = document.createElement('h2');
  title.textContent = 'Bauhof';

  const intro = document.createElement('p');
  intro.textContent = `Willkommen ${currentUser.username}. Zu Beginn steht nur das Rathaus zum Bau bereit.`;

  const card = document.createElement('section');
  card.className = 'construction-card';

  const cardTitle = document.createElement('h3');
  cardTitle.textContent = 'Rathaus';

  const cardText = document.createElement('p');
  cardText.textContent = 'Schaltet den Bauhof mit den Hauptkategorien frei.';

  const button = document.createElement('button');
  button.className = 'primary-action';
  button.textContent = 'Rathaus bauen';
  button.addEventListener('click', () => {
    button.disabled = true;
    button.textContent = 'Wird gebaut...';

    window.setTimeout(() => {
      onBuilt();
    }, 1200);
  });

  card.append(cardTitle, cardText, button);
  container.append(title, intro, card);
}

function renderCategories(container) {
  container.innerHTML = '';

  const heading = document.createElement('h2');
  heading.textContent = 'Bauhof - Kategorien';

  const info = document.createElement('p');
  info.textContent = 'Das Rathaus ist fertiggestellt. Verfuegbare Bereiche:';

  const grid = document.createElement('div');
  grid.className = 'category-grid';

  const categories = [
    {
      title: 'Unterkünfte',
      description: 'Wohnhaeuser und Kapazitaet fuer Einwohner.'
    },
    {
      title: 'Versorgung',
      description: 'Nahrungs- und Rohstoffproduktion.'
    },
    {
      title: 'Militär',
      description: 'Ausbildung und Organisation deiner Truppen.'
    },
    {
      title: 'Regierung',
      description: 'Verwaltung, Gesetze und Reichsboni.'
    }
  ];

  categories.forEach((category) => {
    const card = document.createElement('article');
    card.className = 'category-card';

    const title = document.createElement('h3');
    title.textContent = category.title;

    const text = document.createElement('p');
    text.textContent = category.description;

    card.append(title, text);
    grid.appendChild(card);
  });

  container.append(heading, info, grid);
}

function init() {
  renderShell();

  const container = document.getElementById('Bauhof');
  renderTownHallBuild(container, () => {
    sessionStorage.setItem('townHallBuilt', 'true');
    renderCategories(container);
  });

  if (sessionStorage.getItem('townHallBuilt') === 'true') {
    renderCategories(container);
  }
}

init();
