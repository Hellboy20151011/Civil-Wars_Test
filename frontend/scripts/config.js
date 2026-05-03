// Zentrale Frontend-Konfiguration
// API_BASE_URL wird automatisch aus dem aktuellen Host abgeleitet,
// sodass kein Hardcode-Wert für verschiedene Umgebungen nötig ist.
export const API_BASE_URL =
    window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? `${window.location.protocol}//${window.location.hostname}:3000`
        : window.location.origin;
