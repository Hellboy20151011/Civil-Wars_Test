import { initShell, getAuth } from '/scripts/shell.js';
import { el, render } from '/scripts/ui/component.js';
import { formatTimeLeft } from '/scripts/utils/time.js';
import { createApiClient } from '/scripts/api/client.js';
import { openUserStatusStream } from '/scripts/api/sse.js';

const auth = getAuth();
if (!auth) throw new Error('Nicht eingeloggt');

const { apiFetch } = createApiClient(auth);

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

function calcProgress(startDate, endDate) {
	const total = new Date(endDate) - new Date(startDate);
	const done = Date.now() - new Date(startDate);
	if (total <= 0) return 100;
	return Math.min(100, Math.max(0, Math.round((done / total) * 100)));
}

const CATEGORY_LABELS = {
	infrastructure: 'Infrastruktur',
	military: 'Militär',
	government: 'Regierung',
	intelligence: 'Geheimdienst',
	production: 'Produktion',
	housing: 'Wohngebäude',
};

const UNIT_CATEGORY_LABELS = {
	infantry: 'Infanterie',
	vehicle: 'Fahrzeuge',
	navy: 'Marine',
	airforce: 'Luftwaffe',
	defense: 'Verteidigung',
	intel: 'Geheimdienst',
};

// ── Komponenten ───────────────────────────────────────────────────────────────

function createStatCard(title, value) {
	return el('article', {
		className: 'dash-card',
		children: [el('h3', { text: title }), el('p', { text: value })],
	});
}

function createBuildingOverview(buildings) {
	const title = el('h3', { text: 'Gebäude' });

	if (!buildings.length) {
		return el('section', {
			className: 'dash-section',
			children: [title, el('p', { className: 'dash-empty', text: 'Noch keine Gebäude vorhanden.' })],
		});
	}

	// Nach Kategorie gruppieren
	const grouped = {};
	for (const b of buildings) {
		const cat = CATEGORY_LABELS[b.category] ?? b.category;
		if (!grouped[cat]) grouped[cat] = [];
		grouped[cat].push(b);
	}

	const catSections = Object.entries(grouped).map(([catLabel, items]) => {
		const rows = items.map((b) =>
			el('div', {
				className: 'dash-building-row',
				children: [
					el('span', { className: 'dash-building-name', text: b.name }),
					el('span', { className: 'dash-building-count', text: `×${b.anzahl}` }),
				],
			})
		);
		return el('div', {
			className: 'dash-building-group',
			children: [
				el('div', { className: 'dash-group-label', text: catLabel }),
				...rows,
			],
		});
	});

	return el('section', {
		className: 'dash-section',
		children: [title, ...catSections],
	});
}

function createUnitOverview(units) {
	const title = el('h3', { text: 'Einheiten' });

	if (!units.length) {
		return el('section', {
			className: 'dash-section',
			children: [title, el('p', { className: 'dash-empty', text: 'Noch keine Einheiten vorhanden.' })],
		});
	}

	// Nach Kategorie gruppieren
	const grouped = {};
	for (const u of units) {
		const cat = UNIT_CATEGORY_LABELS[u.category] ?? u.category;
		if (!grouped[cat]) grouped[cat] = [];
		grouped[cat].push(u);
	}

	const catSections = Object.entries(grouped).map(([catLabel, items]) => {
		const rows = items.map((u) => {
			const hp = Number(u.health_percentage ?? 100);
			const hpColor = hp >= 70 ? '#22c55e' : hp >= 35 ? '#f59e0b' : '#ef4444';
			const movingBadge = u.is_moving
				? el('span', { className: 'dash-badge dash-badge--moving', text: '✈ Unterwegs' })
				: null;

			return el('div', {
				className: 'dash-unit-row',
				children: [
					el('div', {
						className: 'dash-unit-info',
						children: [
							el('span', { className: 'dash-unit-name', text: u.name }),
							movingBadge,
						].filter(Boolean),
					}),
					el('div', {
						className: 'dash-unit-meta',
						children: [
							el('span', { className: 'dash-unit-qty', text: `×${u.quantity}` }),
							el('div', {
								className: 'dash-hp-bar',
								children: [
									el('div', {
										className: 'dash-hp-fill',
										attrs: { style: `width:${hp}%;background:${hpColor}` },
									}),
								],
							}),
							el('span', { className: 'dash-hp-label', text: `${hp}%` }),
						],
					}),
				],
			});
		});

		return el('div', {
			className: 'dash-building-group',
			children: [
				el('div', { className: 'dash-group-label', text: catLabel }),
				...rows,
			],
		});
	});

	return el('section', {
		className: 'dash-section',
		children: [title, ...catSections],
	});
}

function createQueueOverview(queue) {
	const title = el('h3', { text: 'Bauwarteschlange' });

	if (!queue.length) {
		return el('section', {
			className: 'dash-section',
			children: [title, el('p', { className: 'dash-empty', text: 'Keine aktiven Bauaufträge.' })],
		});
	}

	const current = queue[0];
	const waitingCount = Math.max(0, queue.length - 1);
	const lastQueued = queue[queue.length - 1];
	const progress = calcProgress(current.erstellt_am, current.fertig_am);
	const timeLeft = formatTimeLeft(current.fertig_am);

	const queueItem = el('div', {
		className: 'dash-queue-item',
		children: [
			el('div', {
				className: 'dash-queue-header',
				children: [
					el('span', { className: 'dash-queue-name', text: current.name }),
					el('span', { className: 'dash-queue-time', text: timeLeft, attrs: { 'data-fertig': current.fertig_am } }),
				],
			}),
			el('div', {
				className: 'dash-progress-bar',
				children: [
					el('div', {
						className: 'dash-progress-fill',
						attrs: {
							style: `width:${progress}%`,
							'data-start': current.erstellt_am,
							'data-end': current.fertig_am,
						},
					}),
				],
			}),
			el('div', {
				className: 'dash-queue-footer',
				children: [
					el('span', { className: 'dash-queue-pct', text: `${progress}%` }),
					el('span', { text: `Fertig: ${new Date(current.fertig_am).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}` }),
				],
			}),
		],
	});

	const waitingNote = waitingCount > 0
		? el('p', {
			className: 'dash-queue-note',
			text: waitingCount === 1
				? `1 weiterer Bauauftrag wartet (fertig um ${new Date(lastQueued.fertig_am).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}).`
				: `${waitingCount} weitere Bauaufträge warten (letzter fertig um ${new Date(lastQueued.fertig_am).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}).`,
		})
		: null;

	return el('section', {
		className: 'dash-section',
		children: [title, queueItem, waitingNote].filter(Boolean),
	});
}

function DashboardView({ auth: authData, status, units }) {
	const activeUnits = units.filter((u) => u.quantity > 0);
	const queueCount = status.queue?.length ?? 0;
	const buildingCount = (status.buildings ?? []).reduce((sum, b) => sum + Number(b.anzahl), 0);

	return [
		el('h2', { text: `Willkommen, ${authData.user.username}!` }),
		el('section', {
			className: 'dash-grid',
			children: [
				createStatCard('Gebäudetypen', String((status.buildings ?? []).length)),
				createStatCard('Gebäude gesamt', String(buildingCount)),
				createStatCard('In Bau', String(queueCount)),
				createStatCard('Einheitentypen', String(activeUnits.length)),
			],
		}),
		el('div', {
			className: 'dash-columns',
			children: [
				el('div', {
					className: 'dash-col',
					children: [
						createBuildingOverview(status.buildings ?? []),
						createQueueOverview(status.queue ?? []),
					],
				}),
				el('div', {
					className: 'dash-col',
					children: [createUnitOverview(activeUnits)],
				}),
			],
		}),
	];
}

// ── Countdowns aktualisieren ──────────────────────────────────────────────────

function startCountdowns(container) {
	let rafId;

	const update = () => {
		// Zeit-Anzeige – nur schreiben wenn sich der Wert ändert
		container.querySelectorAll('[data-fertig]').forEach((node) => {
			const next = formatTimeLeft(node.dataset.fertig);
			if (node.textContent !== next) node.textContent = next;
		});

		// Fortschrittsbalken + Prozentzahl live aktualisieren
		container.querySelectorAll('[data-start][data-end]').forEach((bar) => {
			const pct = calcProgress(bar.dataset.start, bar.dataset.end);
			const next = `${pct}%`;
			if (bar.style.width !== next) bar.style.width = next;

			const footer = bar.closest('.dash-queue-item')?.querySelector('.dash-queue-pct');
			if (footer && footer.textContent !== next) footer.textContent = next;
		});

		rafId = globalThis.requestAnimationFrame(update);
	};

	rafId = globalThis.requestAnimationFrame(update);
	return () => globalThis.cancelAnimationFrame(rafId);
}

// ── Init ──────────────────────────────────────────────────────────────────────

async function renderDashboard() {
	await initShell();

	const container = document.getElementById('Dashboard');

	const [status, unitsData] = await Promise.all([
		apiFetch('/me'),
		apiFetch('/units/me'),
	]);

	const units = Array.isArray(unitsData) ? unitsData : (unitsData.units ?? []);

	render(container, DashboardView({ auth, status, units }));
	const stopCountdowns = startCountdowns(container);

	// ── SSE: Queue automatisch aktualisieren wenn Bau fertig ─────────────────
	let source;
	try {
		source = await openUserStatusStream(auth.token);
	} catch (err) {
		console.error('SSE-Stream konnte nicht gestartet werden:', err);
		return;
	}
	let lastQueueLength = status.queue?.length ?? 0;

	source.addEventListener('status', async (evt) => {
		try {
			const data = JSON.parse(evt.data);
			const nextStatus = data.status ?? {};
			const newQueueLength = nextStatus.queue?.length ?? 0;

			// Queue hat sich verkleinert → Bau fertig oder abgebrochen
			if (newQueueLength < lastQueueLength) {
				lastQueueLength = newQueueLength;
				stopCountdowns();

				const [freshStatus, freshUnitsData] = await Promise.all([
					apiFetch('/me'),
					apiFetch('/units/me'),
				]);
				const freshUnits = Array.isArray(freshUnitsData)
					? freshUnitsData
					: (freshUnitsData.units ?? []);

				render(container, DashboardView({ auth, status: freshStatus, units: freshUnits }));
				startCountdowns(container);
				lastQueueLength = freshStatus.queue?.length ?? 0;
			} else {
				lastQueueLength = newQueueLength;
			}
		} catch {
			// SSE-Parse-Fehler ignorieren
		}
	});

	// Aufräumen wenn Seite verlassen wird
	window.addEventListener('beforeunload', () => {
		source.close();
		stopCountdowns();
	});
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

