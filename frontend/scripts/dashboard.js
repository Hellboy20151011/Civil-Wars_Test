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

	const [status, units, unitTypes] = await Promise.all([
		apiFetch('/me'),
		apiFetch('/units/me'),
		apiFetch('/units/types'),
	]);

	const heading = document.createElement('h2');
	heading.textContent = `Willkommen, ${auth.user.username}!`;

	const cards = document.createElement('section');
	cards.className = 'dash-grid';

	const unitCountCard = createStatCard('Eigene Einheiten', String(units.length ?? 0));
	cards.append(
		createStatCard('Gebäude', String(status.buildings?.length ?? 0)),
		createStatCard('Bauwarteschlange', String(status.queue?.length ?? 0)),
		createStatCard('Einheiten-Typen', String(unitTypes.length ?? 0)),
		unitCountCard,
	);

	const msg = createMessageBox();

	const trainSection = document.createElement('section');
	trainSection.className = 'dash-train';

	const trainTitle = document.createElement('h3');
	trainTitle.textContent = 'Schnelltraining';

	const trainHint = document.createElement('p');
	trainHint.textContent = 'Trainiere direkt 1x Soldat (benötigt Kaserne Level 1).';

	const unitList = document.createElement('section');
	unitList.className = 'dash-units';
	const unitTitle = document.createElement('h3');
	unitTitle.textContent = 'Deine Einheiten';
	unitList.appendChild(unitTitle);

	function renderUnitList(unitData) {
		while (unitList.children.length > 1) unitList.removeChild(unitList.lastChild);
		if (!unitData.length) {
			const empty = document.createElement('p');
			empty.textContent = 'Noch keine Einheiten vorhanden.';
			unitList.appendChild(empty);
		} else {
			unitData.forEach((u) => {
				const row = document.createElement('div');
				row.className = 'dash-row';
				row.textContent = `${u.name} - Menge: ${u.quantity} - HP: ${u.health_percentage}%`;
				unitList.appendChild(row);
			});
		}
		unitCountCard.querySelector('p').textContent = String(unitData.length);
	}

	const trainBtn = document.createElement('button');
	trainBtn.className = 'primary-action';
	trainBtn.textContent = '1x Soldat trainieren';
	trainBtn.addEventListener('click', async () => {
		trainBtn.disabled = true;
		try {
			const result = await apiFetch('/units/train', {
				method: 'POST',
				body: JSON.stringify({ unit_type_id: 1, quantity: 1 }),
			});
			msg.textContent = result.message || 'Einheit erfolgreich trainiert.';
			msg.classList.remove('is-error');
			const updatedUnits = await apiFetch('/units/me');
			renderUnitList(updatedUnits);
		} catch (err) {
			msg.textContent = err.message;
			msg.classList.add('is-error');
		} finally {
			trainBtn.disabled = false;
		}
	});

	trainSection.append(trainTitle, trainHint, trainBtn);

	renderUnitList(units);

	container.append(heading, cards, msg, trainSection, unitList);
}

try {
	await renderDashboard();
} catch (err) {
	const container = document.getElementById('Dashboard');
	container.innerHTML = `<p style="color:#f88">Fehler beim Laden des Dashboards: ${err.message}</p>`;
}

