import { initShell, getAuth } from '/scripts/shell.js';

const API_BASE_URL = 'http://localhost:3000';

const auth = getAuth();
if (!auth) throw new Error('Nicht eingeloggt');

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
	if (!res.ok) {
		throw Object.assign(new Error(data.message || 'Fehler'), { status: res.status });
	}

	return data;
}

function createStatCard(title, value) {
	const card = document.createElement('article');
	card.className = 'dash-card';

	const h = document.createElement('h3');
	h.textContent = title;

	const v = document.createElement('p');
	v.textContent = value;

	card.append(h, v);
	return card;
}

function createMessageBox() {
	const msg = document.createElement('p');
	msg.id = 'dashboard-message';
	msg.className = 'dash-message';
	return msg;
}

async function renderDashboard() {
	await initShell();

	const container = document.getElementById('Dashboard');
	container.innerHTML = '';

	const [status, units] = await Promise.all([
		apiFetch('/me'),
		apiFetch('/units/me'),
	]);

	const heading = document.createElement('h2');
	heading.textContent = `Willkommen, ${auth.user.username}!`;

	const cards = document.createElement('section');
	cards.className = 'dash-grid';

	cards.append(
		createStatCard('Gebäude', String(status.buildings?.length ?? 0)),
		createStatCard('Bauwarteschlange', String(status.queue?.length ?? 0)),
		createStatCard('Eigene Einheiten', String(units.length ?? 0)),
	);

	const unitList = document.createElement('section');
	unitList.className = 'dash-units';
	const unitTitle = document.createElement('h3');
	unitTitle.textContent = 'Deine Einheiten';
	unitList.appendChild(unitTitle);

	if (!units.length) {
		const empty = document.createElement('p');
		empty.textContent = 'Noch keine Einheiten vorhanden.';
		unitList.appendChild(empty);
	} else {
		units.forEach((u) => {
			const row = document.createElement('div');
			row.className = 'dash-row';
			row.textContent = `${u.name} - Menge: ${u.quantity} - HP: ${u.health_percentage}%`;
			unitList.appendChild(row);
		});
	}

	container.append(heading, cards, unitList);
}

try {
	await renderDashboard();
} catch (err) {
	const container = document.getElementById('Dashboard');
	container.innerHTML = `<p style="color:#f88">Fehler beim Laden des Dashboards: ${err.message}</p>`;
}

