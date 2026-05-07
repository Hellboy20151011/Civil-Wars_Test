// Ressourcenleiste und Produktionspanel für das gemeinsame Shell-Layout

import { el, render } from '/scripts/ui/component.js';
import { formatTimeLeft } from '/scripts/utils/time.js';

/**
 * Rendert die Ressourcenleiste oben.
 * @param {object} status - Spielerstatus von /me
 */
export function renderResourceBar(status) {
  const bar = document.getElementById('resource-bar');
  if (!bar) return;

  const res = status.resources ?? {};
  const strom = status.strom ?? { frei: 0 };
  const bevoelkerung = status.bevoelkerung ?? 0;

  const items = [
    { key: 'geld',         label: '💰', value: Number(res.geld         ?? 0) },
    { key: 'stein',        label: '🪨', value: Number(res.stein        ?? 0) },
    { key: 'stahl',        label: '⚙️', value: Number(res.stahl        ?? 0) },
    { key: 'treibstoff',   label: '🛢️', value: Number(res.treibstoff   ?? 0) },
    { key: 'strom',        label: '⚡', value: Number(strom.frei        ?? 0) },
    { key: 'bevoelkerung', label: '👥', value: bevoelkerung },
  ];

  const nodes = items.map(({ key, label, value }) =>
    el('div', {
      className: 'resource-item',
      dataset: { resource: key },
      children: [
        el('span', { text: label, attrs: { style: 'margin-right:3px' } }),
        el('span', {
          text: value.toLocaleString('de-DE'),
          dataset: { resourceValue: key },
        }),
      ],
    })
  );

  render(bar, nodes);
}

/**
 * Rendert das Produktionspanel (Sidebar-Bereich).
 * @param {object} status - Spielerstatus von /me
 * @param {object|null} researchOverview - Forschungsübersicht oder null
 */
export function renderProductionPanel(status, researchOverview = null) {
  const panel = document.getElementById('production-panel');
  if (!panel) return;

  const prod = status.production ?? {};

  const rows = [
    { label: '💰 Geld',       key: 'geld'       },
    { label: '🪨 Stein',      key: 'stein'      },
    { label: '⚙️ Stahl',      key: 'stahl'      },
    { label: '🛢️ Treibstoff', key: 'treibstoff' },
  ];

  const rowNodes = rows.map(({ label, key }) => {
    const val = Number(prod[key] ?? 0);
    return el('div', {
      className: 'production-item',
      children: [
        el('span', { text: label }),
        el('span', {
          text: val > 0 ? `+${val.toLocaleString('de-DE')}` : '+0',
          dataset: { productionFor: key },
        }),
      ],
    });
  });

  const activeResearch = researchOverview?.activeResearch ?? null;
  const researchNodes = [el('h3', { text: 'Forschung' })];

  if (activeResearch) {
    researchNodes.push(
      el('div', {
        className: 'production-item',
        children: [
          el('span', { text: activeResearch.name }),
          el('span', {
            dataset: { researchCountdown: 'active' },
            text: formatTimeLeft(activeResearch.endsAt),
          }),
        ],
      })
    );
  } else {
    researchNodes.push(
      el('div', {
        className: 'production-item',
        children: [
          el('span', { text: 'Keine aktive Forschung' }),
          el('span', { text: '—' }),
        ],
      })
    );
  }

  render(panel, [el('h3', { text: 'Produktion / Tick' }), ...rowNodes, ...researchNodes]);
}
