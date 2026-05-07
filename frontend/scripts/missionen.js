import { initShell, getAuth } from '/scripts/shell.js';
import { el, render } from '/scripts/ui/component.js';
import { formatTimeLeft } from '/scripts/utils/time.js';
import { createApiClient } from '/scripts/api/client.js';

const auth = getAuth();
if (!auth) throw new Error('Nicht eingeloggt');

const { apiGet } = createApiClient(auth);

const outgoingList = document.getElementById('outgoing-list');
const incomingList = document.getElementById('incoming-list');
const combatReportsList = document.getElementById('combat-reports-list');
const spyMissionsList = document.getElementById('spy-missions-list');
const spyReportsList = document.getElementById('spy-reports-list');

const countdowns = new Map();

function clearCountdowns() {
  countdowns.clear();
}

function addCountdownNode(node, isoTime) {
  const id = node.dataset.countdownId;
  if (!id) return;
  countdowns.set(id, { node, isoTime });
}

function tickCountdowns() {
  for (const { node, isoTime } of countdowns.values()) {
    node.textContent = formatTimeLeft(isoTime, { doneText: 'Wird verarbeitet...', showSecondsWithHours: true });
  }
}

function missionStatusLabel(mission) {
  return mission.status === 'traveling_back' ? 'Rueckreise' : 'Anreise';
}

function missionTimeField(mission) {
  return mission.status === 'traveling_back' ? mission.return_time : mission.arrival_time;
}

function emptyState(text) {
  return el('div', { className: 'spy-empty', text });
}

function errorState(message) {
  return el('div', { className: 'spy-error', text: message });
}

function clearNode(node) {
  render(node, []);
}

function createMetaSpan(text) {
  return el('span', { text });
}

function createCountdownLine(label, counterId) {
  const strong = el('strong', { attrs: { 'data-countdown-id': counterId } });
  return {
    node: strong,
    line: el('span', { children: [label, ' ', strong] }),
  };
}

function createCombatMissionCard(mission, direction) {
  const isReturning = mission.status === 'traveling_back';
  const counterId = `${direction}-${mission.id}`;
  const countdown = createCountdownLine(
    direction === 'out'
      ? '⏱ Restzeit:'
      : '⏱ Ankunft in:',
    counterId
  );
  const card = el('div', {
    className: 'spy-card',
    children: [
      el('div', {
        className: 'spy-card-header',
        children: [
          el('span', { className: 'spy-card-icon', text: direction === 'out' ? (isReturning ? '🏠' : '⚔') : '🚨' }),
          el('strong', { text: direction === 'out' ? `Ziel: ${mission.defender_username}` : `Angreifer: ${mission.attacker_username}` }),
          el('span', {
            className: `spy-card-status ${isReturning ? 'returning' : 'traveling'}`,
            text: direction === 'out' ? missionStatusLabel(mission) : 'Anreise',
          }),
        ],
      }),
      el('div', {
        className: 'spy-card-body',
        children: [
          createMetaSpan(
            direction === 'out'
              ? `📍 Zielkoordinaten: (${mission.target_x}, ${mission.target_y})`
              : `📍 Ursprung: (${mission.origin_x}, ${mission.origin_y})`
          ),
          createMetaSpan(`📏 Distanz: ${Number(mission.distance).toFixed(1)} Felder`),
          countdown.line,
        ],
      }),
    ],
  });

  return { card, countdownNode: countdown.node };
}

function createLossList(items, keyLabel, keyValue) {
  if (!items?.length) {
    return el('ul', { children: [el('li', { text: 'Keine Daten' })] });
  }

  return el('ul', {
    children: items.map((item) => el('li', { text: `${item[keyLabel]}: ${item[keyValue]}` })),
  });
}

function createCombatReportContent(result, isAttacker) {
  if (!result) {
    return [el('p', { text: 'Kein Ergebnis gespeichert.' })];
  }

  const won = Boolean(result.attackerWon);
  const myWin = isAttacker ? won : !won;
  const myRate = isAttacker ? result.attackerCasualtyRate : result.defenderCasualtyRate;
  const enemyRate = isAttacker ? result.defenderCasualtyRate : result.attackerCasualtyRate;

  return [
    el('p', { children: [el('strong', { text: 'Ausgang:' }), ` ${myWin ? 'Sieg' : 'Niederlage'}`] }),
    el('p', { children: [el('strong', { text: 'Eigene Verlustrate:' }), ` ${Math.round((Number(myRate) || 0) * 100)}%`] }),
    el('p', { children: [el('strong', { text: 'Gegnerische Verlustrate:' }), ` ${Math.round((Number(enemyRate) || 0) * 100)}%`] }),
    el('details', {
      children: [
        el('summary', { children: [el('strong', { text: 'Einheitenverluste im Detail' })] }),
        el('div', {
          attrs: { style: 'display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:8px;' },
          children: [
            el('div', {
              children: [
                el('div', { children: [el('strong', { text: 'Angreifer' })] }),
                createLossList(result.attackerUnits, 'unitName', 'survived'),
              ],
            }),
            el('div', {
              children: [
                el('div', { children: [el('strong', { text: 'Verteidiger' })] }),
                createLossList(result.defenderUnits, 'unitName', 'losses'),
              ],
            }),
          ],
        }),
      ],
    }),
  ];
}

function createCombatReportCard(mission, authUserId) {
  const result = parseResult(mission.result);
  const isAttacker = Number(mission.attacker_id) === Number(authUserId);
  const opponent = isAttacker ? mission.defender_username : mission.attacker_username;
  const reportAt = mission.arrival_time ? new Date(mission.arrival_time).toLocaleString('de-DE') : '-';

  return el('div', {
    className: 'spy-card',
    children: [
      el('div', {
        className: 'spy-card-header',
        children: [
          el('span', { className: 'spy-card-icon', text: '📋' }),
          el('strong', { text: `${isAttacker ? 'Angriff auf' : 'Verteidigung gegen'}: ${opponent}` }),
          el('span', { className: 'spy-card-date', text: reportAt }),
        ],
      }),
      el('div', { className: 'spy-card-meta', text: `Distanz: ${Number(mission.distance).toFixed(1)} Felder` }),
      el('div', { className: 'spy-card-content', children: createCombatReportContent(result, isAttacker) }),
      el('div', {
        className: 'spy-card-meta',
        attrs: { style: 'margin-top:8px;' },
        children: [
          el('a', {
            text: 'Details anzeigen',
            attrs: { href: `/pages/kampfbericht.html?missionId=${mission.id}` },
          }),
        ],
      }),
    ],
  });
}

function createSpyMissionCard(mission) {
  const isReturning = mission.status === 'traveling_back';
  const counterId = `spy-${mission.id}`;
  const countdown = createCountdownLine(`⏱ ${isReturning ? 'Rueckkunft:' : 'Ankunft:'}`, counterId);
  return {
    countdownNode: countdown.node,
    card: el('div', {
      className: 'spy-card',
      children: [
        el('div', {
          className: 'spy-card-header',
          children: [
            el('span', { className: 'spy-card-icon', text: isReturning ? '🏠' : '🕵️' }),
            el('strong', { text: `${isReturning ? 'Rückkehr von' : 'Mission zu'}: ${mission.target_username}` }),
            el('span', {
              className: `spy-card-status ${isReturning ? 'returning' : 'traveling'}`,
              text: isReturning ? 'Kehrt zurück' : 'Reist zum Ziel',
            }),
          ],
        }),
        el('div', {
          className: 'spy-card-body',
          children: [
            createMetaSpan(`📍 Ziel: (${mission.target_kx}, ${mission.target_ky})`),
            createMetaSpan(`👥 Spione: ${mission.spies_sent}`),
            countdown.line,
          ],
        }),
      ],
    }),
  };
}

function createStat(label, value, className = 'spy-stat-value') {
  return el('div', {
    className: 'spy-stat',
    children: [
      el('span', { className: 'spy-stat-label', text: label }),
      el('span', { className, text: String(value) }),
    ],
  });
}

function createReportRow(label, value, valueClassName) {
  return el('div', {
    className: `spy-report-row${valueClassName ? ` ${valueClassName}` : ''}`,
    children: [el('span', { text: label }), el('strong', { text: String(value) })],
  });
}

function createReportSection(title, contentNodes, open = false) {
  if (open) {
    return el('details', {
      className: 'spy-report-section',
      attrs: { open: '' },
      children: [
        el('summary', { className: 'spy-report-section-title', text: title }),
        ...contentNodes,
      ],
    });
  }

  return el('div', {
    className: 'spy-report-section',
    children: [el('div', { className: 'spy-report-section-title', text: title }), ...contentNodes],
  });
}

function createSpyReportContent(report, record) {
  if (!report.success) {
    return [
      el('div', { className: 'spy-report-badge fail', text: '❌ Fehlgeschlagen' }),
      el('div', {
        className: 'spy-report-stats',
        children: [
          createStat('⚔ Eigener Angriff', report.totalAttack ?? '?'),
          createStat('🛡 Geg. Abwehr (±20%)', `~${report.defenseValueFuzzy ?? '?'}`),
          createStat('💀 Spione verloren', report.spiesLost ?? record.spies_sent, 'spy-stat-value danger'),
        ],
      }),
    ];
  }

  const detail = report.detail ?? 'level1';
  const levelLabels = { level1: '🔎 Stufe 1', level2: '🔍 Stufe 2', level3: '🕵️ Stufe 3' };
  const levelDesc = {
    level1: 'Einfache Aufklärung',
    level2: 'Erweiterte Mission',
    level3: 'Vollständige Aufklärung (unentdeckt)',
  };

  const stats = [
    createStat('⚔ Eigener Angriff', report.totalAttack ?? '?'),
    detail === 'level1'
      ? createStat('🛡 Geg. Abwehr (±10%)', `~${report.defenseValueFuzzy ?? '?'}`)
      : detail === 'level2'
      ? createStat('🛡 Geg. Abwehr (±5%)', `~${report.totalDefense ?? '?'}`)
      : createStat('🛡 Geg. Abwehr (exakt)', report.totalDefense ?? '?'),
  ];

  const nodes = [
    el('div', { className: 'spy-report-badge success', text: `${levelLabels[detail]} – ${levelDesc[detail]}` }),
    el('div', { className: 'spy-report-stats', children: stats }),
  ];

  if (detail === 'level1') {
    nodes.push(
      createReportSection('Gebäude', [createReportRow('🏚 Raubbare Gebäude (ca.):', report.plunderableBuildingsApprox ?? '?')])
    );
    return nodes;
  }

  if (detail === 'level2') {
    const buildings = (report.productionBuildings ?? []).map((building) =>
      createReportRow(building.name, `${building.count ?? building.level ?? '?'}×`)
    );
    nodes.push(
      createReportSection('🏗 Produktionsgebäude', buildings.length ? buildings : [el('div', { className: 'spy-report-row muted', text: 'Keine' })])
    );
    nodes.push(
      createReportSection('Einheiten', [
        createReportRow('⚔️ Einheiten gesamt', report.totalUnits ?? '?'),
        createReportRow('🛡 Verteidigungen gesamt', report.totalDefenses ?? '?'),
      ])
    );
    return nodes;
  }

  const buildings = (report.productionBuildings ?? []).map((building) =>
    createReportRow(building.name, `${building.count ?? building.level ?? '?'}×`)
  );
  const units = Object.entries(report.units ?? {})
    .filter(([, value]) => value.quantity > 0)
    .map(([name, value]) => createReportRow(name, value.quantity));
  const defenses = (report.defenses ?? []).map((entry) => createReportRow(entry.name, entry.quantity));
  nodes.push(createReportSection('🏗 Produktionsgebäude', buildings.length ? buildings : [el('div', { className: 'spy-report-row muted', text: 'Keine' })], true));
  nodes.push(createReportSection('⚔️ Einheiten', units.length ? units : [el('div', { className: 'spy-report-row muted', text: 'Keine' })], true));
  nodes.push(createReportSection('🛡 Verteidigungen', defenses.length ? defenses : [el('div', { className: 'spy-report-row muted', text: 'Keine' })], true));
  return nodes;
}

function parseResult(result) {
  if (!result) return null;
  if (typeof result === 'string') {
    try {
      return JSON.parse(result);
    } catch {
      return null;
    }
  }
  return result;
}

async function loadCombatMissions() {
  try {
    const [outgoingRes, incomingRes] = await Promise.all([
      apiGet('/combat/missions'),
      apiGet('/combat/incoming'),
    ]);

    const outgoing = outgoingRes.data ?? [];
    const incoming = incomingRes.data ?? [];

    if (!outgoing.length) {
      render(outgoingList, [emptyState('Keine laufenden Angriffe.')]);
    } else {
      clearNode(outgoingList);
      for (const m of outgoing) {
        const time = missionTimeField(m);
        const { card, countdownNode: node } = createCombatMissionCard(m, 'out');
        outgoingList.appendChild(card);
        if (node && time) addCountdownNode(node, time);
      }
    }

    if (!incoming.length) {
      render(incomingList, [emptyState('Keine eingehenden Angriffe.')]);
    } else {
      clearNode(incomingList);
      for (const m of incoming) {
        const { card, countdownNode: node } = createCombatMissionCard(m, 'in');
        incomingList.appendChild(card);
        if (node) addCountdownNode(node, m.arrival_time);
      }
    }

    tickCountdowns();
  } catch (err) {
    render(outgoingList, [errorState(err.message)]);
    render(incomingList, [errorState(err.message)]);
  }
}

async function loadCombatReports() {
  try {
    const res = await apiGet('/combat/history');
    const history = res.data ?? [];

    if (!history.length) {
      render(combatReportsList, [emptyState('Noch keine Kampfberichte vorhanden.')]);
      return;
    }

    clearNode(combatReportsList);
    for (const m of history) {
      combatReportsList.appendChild(createCombatReportCard(m, auth.user.id));
    }
  } catch (err) {
    render(combatReportsList, [errorState(err.message)]);
  }
}

function missionTimeFieldSpy(mission) {
  return mission.status === 'traveling_back' ? mission.return_time : mission.arrival_time;
}

async function loadSpyMissions() {
  try {
    const res = await apiGet('/espionage/missions');
    const missions = res.data ?? [];

    if (!missions.length) {
      render(spyMissionsList, [emptyState('Keine laufenden Missionen.')]);
      return;
    }

    clearNode(spyMissionsList);
    for (const m of missions) {
      const targetTime = missionTimeFieldSpy(m);
      const { card, countdownNode: node } = createSpyMissionCard(m);
      spyMissionsList.appendChild(card);
      if (node && targetTime) addCountdownNode(node, targetTime);
    }

    tickCountdowns();
  } catch (err) {
    render(spyMissionsList, [errorState(err.message)]);
  }
}

function renderSpyReport(r) {
  const report = r.report ?? {};
  const date = new Date(r.created_at).toLocaleString('de-DE');

  return el('div', {
    className: 'spy-card',
    children: [
      el('div', {
        className: 'spy-card-header',
        children: [
          el('span', { className: 'spy-card-icon', text: report.success ? '📋' : '❌' }),
          el('strong', { text: `Bericht: ${r.target_username}` }),
          el('span', { className: 'spy-card-date', text: date }),
        ],
      }),
      el('div', {
        className: 'spy-card-meta',
        children: [
          createMetaSpan(`👥 Entsandt: ${r.spies_sent}`),
          createMetaSpan(`🏠 Zurückgekehrt: ${r.spies_returned ?? '–'}`),
        ],
      }),
      el('div', { className: 'spy-card-content', children: createSpyReportContent(report, r) }),
    ],
  });
}

async function loadSpyReports() {
  try {
    const res = await apiGet('/espionage/reports');
    const reports = res.data ?? [];

    if (!reports.length) {
      render(spyReportsList, [emptyState('Noch keine Berichte vorhanden.')]);
      return;
    }

    clearNode(spyReportsList);
    for (const r of reports) {
      spyReportsList.appendChild(renderSpyReport(r));
    }
  } catch (err) {
    render(spyReportsList, [errorState(err.message)]);
  }
}

function setupTabs() {
  document.querySelectorAll('.spy-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.spy-tab').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.spy-section').forEach((s) => (s.style.display = 'none'));
      btn.classList.add('active');
      document.getElementById(`tab-${btn.dataset.tab}`).style.display = '';
    });
  });
}

window.addEventListener('combat-result', () => {
  loadCombatMissions();
  loadCombatReports();
});
window.addEventListener('combat-return', () => {
  loadCombatMissions();
  loadCombatReports();
});
window.addEventListener('combat-incoming', () => {
  loadCombatMissions();
});
window.addEventListener('spy-return', () => {
  loadSpyMissions();
  loadSpyReports();
});
window.addEventListener('spy-mission-update', () => {
  loadSpyMissions();
  loadSpyReports();
});

setupTabs();
await initShell();
clearCountdowns();
await Promise.all([loadCombatMissions(), loadCombatReports(), loadSpyMissions(), loadSpyReports()]);

setInterval(tickCountdowns, 1000);
setInterval(async () => {
  clearCountdowns();
  await Promise.all([loadCombatMissions(), loadSpyMissions()]);
}, 10000);
setInterval(async () => {
  await Promise.all([loadCombatReports(), loadSpyReports()]);
}, 30000);
