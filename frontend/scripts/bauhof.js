import { initShell, getAuth } from '/scripts/shell.js';

const API_BASE_URL = 'http://localhost:3000';

const auth = getAuth();
if (!auth) throw new Error('Nicht eingeloggt');

// ── Rathaus-Baukarte ──────────────────────────────────────
function renderTownHallBuild(container, onStartBuild) {
  container.innerHTML = '';

  const title = document.createElement('h2');
  title.textContent = 'Bauhof';

  const intro = document.createElement('p');
  intro.textContent = `Willkommen ${auth.user.username}. Zu Beginn steht nur das Rathaus zum Bau bereit.`;

  const card = document.createElement('section');
  card.className = 'construction-card';

  const cardTitle = document.createElement('h3');
  cardTitle.textContent = 'Rathaus';

  const cardText = document.createElement('p');
  cardText.textContent = 'Schaltet den Bauhof mit den Hauptkategorien frei. Bauzeit: 1 Minute. Keine Kosten.';

  const button = document.createElement('button');
  button.className = 'primary-action';
  button.textContent = 'Rathaus bauen';
  button.addEventListener('click', onStartBuild);

  card.append(cardTitle, cardText, button);
  container.append(title, intro, card);
}

// ── Countdown während der Bauzeit ─────────────────────────
function renderCountdown(container, endTime, onComplete) {
  container.innerHTML = '';

  const title = document.createElement('h2');
  title.textContent = 'Bauhof';

  const card = document.createElement('section');
  card.className = 'construction-card';

  const cardTitle = document.createElement('h3');
  cardTitle.textContent = 'Rathaus wird gebaut…';

  const countdown = document.createElement('p');
  countdown.className = 'countdown-timer';
  card.append(cardTitle, countdown);
  container.append(title, card);

  const end = new Date(endTime).getTime();

  const interval = setInterval(() => {
    const remaining = Math.max(0, end - Date.now());
    const secs = Math.ceil(remaining / 1000);
    countdown.textContent = `Fertig in: ${secs}s`;

    if (remaining <= 0) {
      clearInterval(interval);
      onComplete();
    }
  }, 500);
}

// ── Kategorien nach Fertigstellung ────────────────────────
function renderCategories(container) {
  container.innerHTML = '';

  const heading = document.createElement('h2');
  heading.textContent = 'Bauhof – Kategorien';

  const info = document.createElement('p');
  info.textContent = 'Das Rathaus ist fertiggestellt. Verfügbare Bereiche:';

  const grid = document.createElement('div');
  grid.className = 'category-grid';

  const categories = [
    { title: 'Unterkünfte', description: 'Wohnhäuser und Kapazität für Einwohner.' },
    { title: 'Versorgung',  description: 'Nahrungs- und Rohstoffproduktion.' },
    { title: 'Militär',     description: 'Ausbildung und Organisation deiner Truppen.' },
    { title: 'Regierung',   description: 'Verwaltung, Gesetze und Reichsboni.' },
  ];

  categories.forEach(({ title, description }) => {
    const card = document.createElement('article');
    card.className = 'category-card';

    const h = document.createElement('h3');
    h.textContent = title;

    const p = document.createElement('p');
    p.textContent = description;

    card.append(h, p);
    grid.appendChild(card);
  });

  container.append(heading, info, grid);
}

// ── Bau beim Server abschließen ───────────────────────────
async function completeBuilding(buildingId) {
  try {
    await fetch(`${API_BASE_URL}/buildings/complete/${buildingId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${auth.token}` }
    });
  } catch (err) {
    console.error('Fehler beim Abschließen:', err);
  }
}

// ── Hauptlogik ────────────────────────────────────────────
async function init() {
  await initShell();

  const container = document.getElementById('Bauhof');

  // Gebäude des Users laden
  const res = await fetch(`${API_BASE_URL}/buildings/me`, {
    headers: { Authorization: `Bearer ${auth.token}` }
  });
  const { buildings } = await res.json();
  const townHall = buildings.find(b => b.name === 'Rathaus');

  // Rathaus fertig
  if (townHall?.status === 'complete') {
    renderCategories(container);
    return;
  }

  // Rathaus im Bau
  if (townHall?.status === 'in_progress') {
    renderCountdown(container, townHall.construction_end_time, async () => {
      await completeBuilding(townHall.id);
      renderCategories(container);
    });
    return;
  }

  // Rathaus noch nicht gestartet
  renderTownHallBuild(container, async () => {
    const startRes = await fetch(`${API_BASE_URL}/buildings/build`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${auth.token}`
      },
      body: JSON.stringify({ building_type_id: 1 })
    });

    if (!startRes.ok) {
      const err = await startRes.json();
      alert(err.message);
      return;
    }

    const { building } = await startRes.json();
    renderCountdown(container, building.construction_end_time, async () => {
      await completeBuilding(building.id);
      renderCategories(container);
    });
  });
}

init();

