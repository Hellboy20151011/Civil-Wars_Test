/**
 * Formatiert eine verbleibende Zeitspanne bis zu einem Zieldatum als lesbaren String.
 *
 * @param {string|Date} targetDate  - ISO-String oder Date-Objekt
 * @param {object}      [opts]
 * @param {string}      [opts.doneText='Fertig']  - Text wenn ms <= 0
 * @param {boolean}     [opts.showSecondsWithHours=false] - Sekunden auch bei h > 0 anzeigen
 * @returns {string}
 */
export function formatTimeLeft(targetDate, { doneText = 'Fertig', showSecondsWithHours = false } = {}) {
    const ms = new Date(targetDate) - Date.now();
    if (ms <= 0) return doneText;
    const totalSec = Math.ceil(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) return showSecondsWithHours ? `${h}h ${m}m ${s}s` : `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
}
