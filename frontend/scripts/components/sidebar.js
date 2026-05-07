// Sidebar-Renderlogik für das gemeinsame Shell-Layout

import { el, render } from '/scripts/ui/component.js';

const BAUHOF_CATEGORIES = [
  { key: 'housing', label: 'Unterkünfte' },
  { key: 'infrastructure', label: 'Industrie' },
  { key: 'military', label: 'Militär' },
  { key: 'government', label: 'Regierung' },
];

const MILITAER_CATEGORIES = [
  { key: 'infantry',  label: 'Infanterie'  },
  { key: 'vehicle',   label: 'Fahrzeuge'   },
  { key: 'ship',      label: 'Marine'      },
  { key: 'air',       label: 'Luftwaffe'   },
  { key: 'defense',   label: 'Verteidigung' },
];

/**
 * Rendert die Sidebar mit Navigation und Logout-Button.
 * @param {Array<{label: string, href: string}>} navLinks - Zusätzliche Links
 * @param {object|null} status - Spielerstatus (für bedingte Links wie GDZ)
 * @param {Function} onLogout - Callback beim Logout-Klick
 */
export function renderSidebar(navLinks, status, onLogout) {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;

  const currentPath = window.location.pathname.toLowerCase();
  const isBauhofPage = currentPath === '/bauhof.html' || currentPath === '/pages/bauhof.html';
  const isMilitaerPage = currentPath === '/militaer.html' || currentPath === '/pages/militaer.html';
  const currentCategory = new URLSearchParams(window.location.search).get('category');

  // Geheimdienstzentrum-Link nur wenn Gebäude vorhanden
  const hasGdh = status?.buildings?.some(
    (b) => b.name?.startsWith('Geheimdienstzentrum') && Number(b.anzahl) > 0
  ) ?? false;

  const defaultLinks = [
    { label: 'Dashboard', href: '/pages/dashboard.html' },
    { label: 'Bauhof', href: '/pages/bauhof.html' },
    { label: 'Militär', href: '/pages/militaer.html' },
    { label: 'Forschungen', href: '/pages/forschungen.html' },
    { label: 'Karte', href: '/pages/karte.html' },
    { label: 'Missionen', href: '/pages/missionen.html' },
    ...(hasGdh ? [{ label: 'Geheimdienstzentrum', href: '/pages/geheimdienstzentrum.html' }] : []),
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
          (hrefLower === '/pages/forschungen.html' && currentPath === '/forschungen.html') ||
          (hrefLower === '/pages/missionen.html' && currentPath === '/missionen.html') ||
          (hrefLower === '/pages/karte.html' && currentPath === '/karte.html') ||
          (hrefLower === '/pages/geheimdienstzentrum.html' && currentPath === '/geheimdienstzentrum.html')
            ? 'is-active'
            : ''
      })
    );
  });

  nodes.push(
    el('button', {
      text: 'Logout',
      attrs: { style: 'margin-top:auto' },
      on: { click: onLogout },
    })
  );

  render(sidebar, nodes);
}
