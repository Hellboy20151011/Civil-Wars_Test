import { initShell, getAuth } from '/scripts/shell.js';
import { API_BASE_URL } from '/scripts/config.js';
import { el, render } from '/scripts/ui/component.js';

const auth = getAuth();
if (!auth) throw new Error('Nicht eingeloggt');

const state = {
  overview: null,
};

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
  if (!res.ok) throw Object.assign(new Error(data.message || 'Fehler'), { status: res.status });
  return data;
}

function formatDurationTicks(ticks) {
  const value = Number(ticks ?? 0);
  const safe = Number.isFinite(value) ? value : 0;
  return `${safe.toLocaleString('de-DE')} Tick(s)`;
}

function formatTimeLeft(targetDate) {
  const ms = new Date(targetDate) - Date.now();
  if (ms <= 0) return 'Fertig';
  const totalSec = Math.ceil(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatCosts(costs) {
  const parts = [];
  if (Number(costs.money ?? 0) > 0) parts.push(`💰 ${Number(costs.money).toLocaleString('de-DE')}`);
  if (Number(costs.steel ?? 0) > 0) parts.push(`⚙️ ${Number(costs.steel).toLocaleString('de-DE')}`);
  if (Number(costs.fuel ?? 0) > 0) parts.push(`🛢️ ${Number(costs.fuel).toLocaleString('de-DE')}`);
  return parts.length > 0 ? parts.join('  ') : 'Kostenlos';
}

function buildProjectCard(project, container) {
  const isLocked = project.status === 'locked';
  const isInProgress = project.status === 'in_progress';
  const isCompleted = project.status === 'completed';

  const statusLabel = isCompleted
    ? 'Abgeschlossen'
    : isInProgress
      ? `In Forschung (${formatTimeLeft(project.endsAt)})`
      : isLocked
        ? 'Gesperrt'
        : 'Verfügbar';

  const statusClass = isCompleted
    ? 'research-status--ok'
    : isInProgress
      ? 'research-status--locked'
      : isLocked
        ? 'research-status--locked'
        : 'research-status--ok';

  return el('article', {
    className: `building-card${project.canStart || isCompleted ? '' : ' is-locked'}`,
    children: [
      el('h4', { text: project.name }),
      el('p', {
        text: statusLabel,
        className: `research-status ${statusClass}`,
      }),
      el('p', {
        className: 'building-card-description',
        text: project.description || 'Forschungsprojekt',
      }),
      el('span', {
        className: 'build-cost',
        text: `Kosten: ${formatCosts(project.costs)}`,
      }),
      el('span', {
        className: 'build-cost',
        text: `Dauer: ${formatDurationTicks(project.durationTicks)}`,
      }),
      el('span', {
        className: 'build-cost',
        text: `Freischaltung: ${project.unlockCategory} Level ${project.unlockLevel}`,
      }),
      project.lockReason
        ? el('span', {
          className: 'unit-lock-hint',
          text: project.lockReason,
        })
        : null,
      project.canStart
        ? el('div', {
          className: 'research-actions',
          children: [
            el('button', {
              className: 'primary-action',
              text: 'Forschung starten',
              on: {
                click: async () => {
                  try {
                    await apiFetch('/research/start', {
                      method: 'POST',
                      body: JSON.stringify({ project_id: project.id }),
                    });
                    await loadOverview();
                    renderPage(container);
                    await initShell();
                  } catch (err) {
                    render(container, [
                      el('p', {
                        attrs: { style: 'color:#f88' },
                        text: `Fehler beim Starten: ${err.message}`,
                      }),
                    ]);
                  }
                },
              },
            }),
          ],
        })
        : null,
    ],
  });
}

function renderPage(container = document.getElementById('Forschungen')) {
  if (!container) return;

  const overview = state.overview;
  if (!overview) return;

  const nodes = [
    el('h2', { text: 'Forschungen' }),
    el('p', {
      className: 'gdh-level-info',
      text: `Forschungslabor Level ${overview.researchLabLevel} – Verteidigungsforschung Level ${overview.defenseResearchLevel}`,
    }),
    overview.activeResearch
      ? el('p', {
        className: 'build-power',
        text: `Aktive Forschung: ${overview.activeResearch.name} – Restzeit: ${formatTimeLeft(overview.activeResearch.endsAt)}`,
      })
      : null,
    el('h3', { text: 'Militärforschung (Verteidigung)' }),
    el('div', {
      className: 'category-grid',
      children: overview.projects.map((project) => buildProjectCard(project, container)),
    }),
    el('div', {
      className: 'research-actions',
      children: [
        el('button', {
          className: 'secondary-action',
          text: 'Zum Militär',
          on: {
            click: () => {
              window.location.href = '/pages/militaer.html?category=defense';
            },
          },
        }),
      ],
    }),
  ];

  render(container, nodes);
}

async function loadOverview() {
  state.overview = await apiFetch('/research/overview');
}

async function init() {
  await initShell();
  const container = document.getElementById('Forschungen');
  if (!container) return;

  try {
    await loadOverview();
    renderPage(container);
  } catch (err) {
    render(container, [
      el('p', {
        attrs: { style: 'color:#f88' },
        text: `Fehler beim Laden: ${err.message}`,
      }),
    ]);
  }
}

init();
