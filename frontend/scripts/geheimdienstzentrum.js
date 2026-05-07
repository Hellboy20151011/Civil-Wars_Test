import { initShell, getAuth } from '/scripts/shell.js';
import { el, render } from '/scripts/ui/component.js';
import { createApiClient } from '/scripts/api/client.js';

const auth = getAuth();
if (!auth) throw new Error('Nicht eingeloggt');

const { apiFetch } = createApiClient(auth);

const state = {
    unitTypes: [],
    myUnits: [],
    myBuildings: [],
    message: '',
};

/** Höchstes vorhandenes Geheimdienstzentrum-Level (0 = keines) */
function getGdhLevel(buildings) {
    let max = 0;
    for (const b of buildings) {
        if (b.name?.startsWith('Geheimdienstzentrum') && Number(b.anzahl) > 0) {
            const match = b.name.match(/Level\s*(\d+)/i);
            if (match) max = Math.max(max, Number(match[1]));
        }
    }
    return max;
}

/** Ob eine Einheit mit diesem building_requirement freigeschaltet ist */
function isUnlocked(unitType, gdhLevel) {
    const req = unitType.building_requirement ?? '';
    const match = req.match(/Level\s*(\d+)/i);
    if (!match) return gdhLevel >= 1;
    return gdhLevel >= Number(match[1]);
}

function getUnitCostsText(ut) {
    const parts = [];
    if (ut.money_cost > 0) parts.push(`💰 ${Number(ut.money_cost).toLocaleString('de-DE')}`);
    if (ut.steel_cost > 0) parts.push(`⚙️ ${Number(ut.steel_cost).toLocaleString('de-DE')}`);
    if (ut.fuel_cost > 0) parts.push(`🛢️ ${Number(ut.fuel_cost).toLocaleString('de-DE')}`);
    return parts.length > 0 ? parts.join('  ') : 'Kostenlos';
}

function buildUnitCard(unitType, container) {
    const gdhLevel = getGdhLevel(state.myBuildings);
    const unlocked = isUnlocked(unitType, gdhLevel);
    const owned = state.myUnits.find((u) => u.unit_type_id === unitType.id || u.name === unitType.name);
    const ownedCount = Number(owned?.quantity ?? owned?.anzahl ?? 0);

    const input = el('input', {
        className: 'build-quantity-input',
        attrs: {
            type: 'number',
            min: '1',
            max: '999',
            value: '1',
            ...(unlocked ? {} : { disabled: '' }),
        },
    });

    const button = el('button', {
        className: 'primary-action',
        text: 'Ausbilden',
        attrs: unlocked ? {} : { disabled: '' },
        on: unlocked ? {
            click: async () => {
                button.disabled = true;
                input.disabled = true;
                try {
                    const quantity = Math.max(1, Math.min(999, Number(input.value) || 1));
                    const result = await apiFetch('/units/train', {
                        method: 'POST',
                        body: JSON.stringify({ unit_type_id: unitType.id, quantity }),
                    });
                    state.message = result.message ?? '';
                    [state.myUnits, state.myBuildings] = await Promise.all([
                        apiFetch('/units/me'),
                        apiFetch('/me').then((s) => s.buildings ?? []),
                    ]);
                    await initShell();
                    renderPage(container);
                } catch (err) {
                    state.message = err.message;
                    renderPage(container);
                }
            },
        } : {},
    });

    const requirementLabel = `Benötigt: ${unitType.building_requirement ?? 'Geheimdienstzentrum'} (aktuell Level ${gdhLevel})`;
    const spyAtk = unitType.spy_attack ?? 0;
    const spyDef = unitType.spy_defense ?? 0;

    return el('article', {
        className: `building-card${unlocked ? '' : ' is-locked'}`,
        children: [
            el('h4', { text: unitType.name }),
            !unlocked ? el('span', { className: 'unit-lock-badge', text: 'Gesperrt' }) : null,
            el('p', {
                className: 'building-card-description',
                text: unitType.description || 'Geheimdiensteinheit für verdeckte Operationen.',
            }),
            el('span', {
                className: 'building-count',
                text: `Vorhanden: ${ownedCount.toLocaleString('de-DE')}`,
            }),
            el('span', {
                className: `build-cost unit-requirement${unlocked ? '' : ' unit-requirement--missing'}`,
                text: requirementLabel,
            }),
            el('span', {
                className: 'build-cost',
                text: getUnitCostsText(unitType),
            }),
            el('span', {
                className: 'build-power',
                text: `⚔️ Spionage ${spyAtk}  🛡️ Abwehr ${spyDef}  🚀 Speed ${unitType.movement_speed}  ⚡ Ausb.: ${unitType.training_time_ticks} Tick(s)`,
            }),
            !unlocked ? el('span', { className: 'unit-lock-hint', text: 'Geheimdienstzentrum-Level erhöhen' }) : null,
            el('div', {
                className: 'building-card-actions',
                children: [input, button],
            }),
        ],
    });
}

function renderPage(container) {
    if (!container) return;

    const gdhLevel = getGdhLevel(state.myBuildings);
    const nodes = [
        el('h2', { text: '🕵️ Geheimdienstzentrum – Einheiten ausbilden' }),
        el('p', {
            className: 'gdh-level-info',
            text: `Geheimdienstzentrum Level ${gdhLevel} – ${
                gdhLevel >= 3 ? 'Alle Einheiten verfügbar' :
                gdhLevel >= 2 ? 'Stufe 2 – SR-71 Aufklärer freigeschaltet' :
                'Stufe 1 – Spion freigeschaltet'
            }`,
        }),
    ];

    if (state.message) {
        nodes.push(el('p', { className: 'dash-message', text: state.message }));
    }

    const cardChildren = [];

    for (const ut of state.unitTypes) {
        cardChildren.push(buildUnitCard(ut, container));
    }

    nodes.push(
        el('div', {
            className: 'category-grid',
            children: cardChildren,
        })
    );

    render(container, nodes);
}

async function init() {
    const container = document.getElementById('Geheimdienstzentrum');
    if (!container) return;

    await initShell();

    try {
        const [unitTypes, myUnits, meStatus] = await Promise.all([
            apiFetch('/units/types/category/intel'),
            apiFetch('/units/me'),
            apiFetch('/me'),
        ]);

        state.unitTypes = Array.isArray(unitTypes) ? unitTypes : (unitTypes.data ?? []);
        state.myUnits = Array.isArray(myUnits) ? myUnits : (myUnits.units ?? []);
        state.myBuildings = meStatus.buildings ?? [];

        renderPage(container);
    } catch (err) {
        console.error(err);
        render(container, [
            el('p', {
                text: `Fehler beim Laden: ${err.message}`,
                attrs: { style: 'color:#f88' },
            }),
        ]);
    }
}

init();
