// Gemeinsames Layout-Modul für alle Spielseiten (außer Login)
// Exportiert: initShell(), getAuth()

import { API_BASE_URL } from '/scripts/config.js';
import { el, render } from '/scripts/ui/component.js';

let liveEventSource = null;
let liveEventSourceToken = null;

const BAUHOF_CATEGORIES = [
  { key: 'housing', label: 'Unterkünfte' },
  { key: 'infrastructure', label: 'Industrie' },
  { key: 'military', label: 'Militär' },
  { key: 'government', label: 'Regierung' },
  { key: 'defense', label: 'Verteidigung' },
];

const MILITAER_CATEGORIES = [
  { key: 'infantry',  label: 'Infanterie'  },
  { key: 'vehicle',   label: 'Fahrzeuge'   },
  { key: 'ship',      label: 'Marine'      },
  { key: 'air',       label: 'Luftwaffe'   },
  { key: 'defense',   label: 'Verteidigung' },
];

export function getAuth() {
  const raw = sessionStorage.getItem('currentUser');
  const token = sessionStorage.getItem('authToken');
  if (!raw || !token || token === 'undefined' || token === 'null') {
    stopLiveUpdates();
    sessionStorage.removeItem('currentUser');
    sessionStorage.removeItem('authToken');
    window.location.href = '/';
    return null;
  }
  return { user: JSON.parse(raw), token };
}

export async function initShell(navLinks = []) {
  const auth = getAuth();
  if (!auth) return;

  renderSidebar(navLinks);

  // /me lädt Ressourcen, Strom, Produktion und Gebäude in einem Request
  try {
    const res = await fetch(`${API_BASE_URL}/me`, {
      headers: { Authorization: `Bearer ${auth.token}` }
    });
    if (!res.ok) throw new Error('Status-Abruf fehlgeschlagen');
    const status = await res.json();
    renderResourceBar(status);
    renderProductionPanel(status);
    startLiveUpdates(auth.token);
  } catch (err) {
    console.error(err);
    const bar = document.getElementById('resource-bar');
    if (bar) {
      render(bar, [
        el('span', {
          text: 'Ressourcen nicht verfügbar',
          attrs: { style: 'color:#f88' },
        }),
      ]);
    }
  }
}

function startLiveUpdates(token) {
  if (!token) return;

  if (liveEventSource && liveEventSourceToken === token) {
    return;
  }

  if (liveEventSource) {
    liveEventSource.close();
    liveEventSource = null;
  }

  const streamUrl = `${API_BASE_URL}/me/stream?token=${encodeURIComponent(token)}`;
  const source = new EventSource(streamUrl);

  source.addEventListener('status', (event) => {
    try {
      const payload = JSON.parse(event.data || '{}');
      if (!payload.status) return;
      renderResourceBar(payload.status);
      renderProductionPanel(payload.status);
    } catch (err) {
      console.error('SSE status parse error:', err);
    }
  });

  source.addEventListener('combat_incoming', (event) => {
    try {
      const d = JSON.parse(event.data || '{}');
      const eta = new Date(d.arrivalTime);
      const mins = Math.round((eta - Date.now()) / 60000);
      showToast(`⚔️ Eingehender Angriff von ${d.attackerUsername}! Ankunft in ~${mins} min.`, 'danger');
    } catch (err) {
      console.error('SSE combat_incoming parse error:', err);
    }
  });

  source.addEventListener('combat_result', (event) => {
    try {
      const d = JSON.parse(event.data || '{}');
      const msg = d.attackerWon
        ? `⚔️ Kampf gegen ${d.defenderUsername}: Sieg! Einheiten kehren zurück.`
        : `⚔️ Kampf gegen ${d.defenderUsername}: Niederlage. Einheiten kehren zurück.`;
      showToast(msg, d.attackerWon ? 'success' : 'warning');
    } catch (err) {
      console.error('SSE combat_result parse error:', err);
    }
  });

  source.addEventListener('combat_return', (event) => {
    try {
      const d = JSON.parse(event.data || '{}');
      showToast(`🏠 Deine Einheiten aus dem Angriff auf ${d.defenderUsername} sind heimgekehrt.`, 'info');
    } catch (err) {
      console.error('SSE combat_return parse error:', err);
    }
  });

  source.addEventListener('error', () => {
    // EventSource reconnectet automatisch.
  });

  liveEventSource = source;
  liveEventSourceToken = token;
}

function stopLiveUpdates() {
  if (liveEventSource) {
    liveEventSource.close();
    liveEventSource = null;
  }
  liveEventSourceToken = null;
}

function renderSidebar(navLinks) {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;

  const currentPath = window.location.pathname.toLowerCase();
  const isBauhofPage = currentPath === '/bauhof.html' || currentPath === '/pages/bauhof.html';
  const isMilitaerPage = currentPath === '/militaer.html' || currentPath === '/pages/militaer.html';
  const currentCategory = new URLSearchParams(window.location.search).get('category');

  const defaultLinks = [
    { label: 'Dashboard', href: '/pages/dashboard.html' },
    { label: 'Bauhof', href: '/pages/bauhof.html' },
    { label: 'Militär', href: '/pages/militaer.html' },
    { label: 'Karte', href: '/pages/karte.html' },
  ];

  const links = defaultLinks.concat(
    navLinks.filter(nl => !defaultLinks.some(dl => dl.href === nl.href))
  );

  const nodes = [];

  links.forEach(({ label, href }) => {
    const hrefLower = href.toLowerCase();

    if (hrefLower === '/bauhof.html' || hrefLower === '/pages/bauhof.html') {
      const groupChildren = [
        el('a', {
          text: label,
          attrs: { href },
          className: isBauhofPage ? 'is-active' : '',
        }),
      ];

      if (isBauhofPage) {
        groupChildren.push(
          el('div', {
            className: 'nav-submenu',
            children: BAUHOF_CATEGORIES.map(({ key, label: categoryLabel }) =>
              el('a', {
                className: `submenu-link${currentCategory === key ? ' is-active' : ''}`,
                text: categoryLabel,
                attrs: { href: `/pages/bauhof.html?category=${key}` },
              })
            ),
          })
        );
      }

      nodes.push(el('div', { className: 'nav-group', children: groupChildren }));
      return;
    }

    if (hrefLower === '/militaer.html' || hrefLower === '/pages/militaer.html') {
      const groupChildren = [
        el('a', {
          text: label,
          attrs: { href },
          className: isMilitaerPage ? 'is-active' : '',
        }),
      ];

      if (isMilitaerPage) {
        groupChildren.push(
          el('div', {
            className: 'nav-submenu',
            children: MILITAER_CATEGORIES.map(({ key, label: categoryLabel }) =>
              el('a', {
                className: `submenu-link${currentCategory === key ? ' is-active' : ''}`,
                text: categoryLabel,
                attrs: { href: `/pages/militaer.html?category=${key}` },
              })
            ),
          })
        );
      }

      nodes.push(el('div', { className: 'nav-group', children: groupChildren }));
      return;
    }

    nodes.push(
      el('a', {
        text: label,
        attrs: { href },
        className:
          currentPath === hrefLower ||
          (hrefLower === '/pages/dashboard.html' && currentPath === '/dashboard.html') ||
          (hrefLower === '/pages/bauhof.html' && currentPath === '/bauhof.html') ||
          (hrefLower === '/pages/militaer.html' && currentPath === '/militaer.html') ||
          (hrefLower === '/pages/karte.html' && currentPath === '/karte.html')
            ? 'is-active'
            : '',
      })
    );
  });

  nodes.push(
    el('button', {
      text: 'Logout',
      attrs: { style: 'margin-top:auto' },
      on: {
        click: () => {
          stopLiveUpdates();
          sessionStorage.removeItem('currentUser');
          sessionStorage.removeItem('authToken');
          window.location.href = '/';
        },
      },
    })
  );

  render(sidebar, nodes);
}

/**
 * Zeigt eine kurze Toast-Benachrichtigung an.
 * @param {string} message
 * @param {'info'|'success'|'warning'|'danger'} type
 */
export function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  // Einblenden
  requestAnimationFrame(() => toast.classList.add('toast--visible'));

  // Nach 5 s ausblenden + entfernen
  setTimeout(() => {
    toast.classList.remove('toast--visible');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
  }, 5000);
}

function renderResourceBar(status) {
  const bar = document.getElementById('resource-bar');
  if (!bar) return;

  const res = status.resources ?? {};
  const strom = status.strom ?? { frei: 0 };
  const bevoelkerung = status.bevoelkerung ?? 0;

  const items = [
    { key: 'geld',       label: '💰', value: Number(res.geld       ?? 0) },
    { key: 'stein',      label: '🪨', value: Number(res.stein      ?? 0) },
    { key: 'stahl',      label: '⚙️', value: Number(res.stahl      ?? 0) },
    { key: 'treibstoff', label: '🛢️', value: Number(res.treibstoff ?? 0) },
    { key: 'strom',      label: '⚡', value: Number(strom.frei ?? 0) },
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

function renderProductionPanel(status) {
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

  render(panel, [el('h3', { text: 'Produktion / Tick' }), ...rowNodes]);
}


