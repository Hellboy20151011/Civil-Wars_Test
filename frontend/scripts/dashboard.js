import { initShell, getAuth } from '/scripts/shell.js';
import { API_BASE_URL } from '/scripts/config.js';
import { el, render } from '/scripts/ui/component.js';

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
	return el('article', {
		className: 'dash-card',
		children: [el('h3', { text: title }), el('p', { text: value })],
	});
}

function createMessageBox() {
	return el('p', {
		className: 'dash-message',
		attrs: { id: 'dashboard-message' },
	});
}

function createUnitList(units) {
	const unitTitle = el('h3', { text: 'Deine Einheiten' });

	if (!units.length) {
		return el('section', {
			className: 'dash-units',
			children: [unitTitle, el('p', { text: 'Noch keine Einheiten vorhanden.' })],
		});
	}

	const rows = units.map((u) =>
		el('div', {
			className: 'dash-row',
			text: `${u.name} - Menge: ${u.quantity} - HP: ${u.health_percentage}%`,
		})
	);

	return el('section', {
		className: 'dash-units',
		children: [unitTitle, ...rows],
	});
}

function DashboardView({ auth, status, units }) {
	return [
		el('h2', { text: `Willkommen, ${auth.user.username}!` }),
		el('section', {
			className: 'dash-grid',
			children: [
				createStatCard('Gebäude', String(status.buildings?.length ?? 0)),
				createStatCard('Bauwarteschlange', String(status.queue?.length ?? 0)),
				createStatCard('Eigene Einheiten', String(units.length ?? 0)),
			],
		}),
		createUnitList(units),
		createMessageBox(),
	];
}

async function renderDashboard() {
	await initShell();

	const container = document.getElementById('Dashboard');

	const [status, units] = await Promise.all([
		apiFetch('/me'),
		apiFetch('/units/me'),
	]);

	render(container, DashboardView({ auth, status, units }));
}

try {
	await renderDashboard();
} catch (err) {
	const container = document.getElementById('Dashboard');
	render(container, [
		el('p', {
			text: `Fehler beim Laden des Dashboards: ${err.message}`,
			attrs: { style: 'color:#f88' },
		}),
	]);
}

