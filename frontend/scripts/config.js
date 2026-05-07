// Zentrale Frontend-Konfiguration
// In Dev läuft die UI auf Vite (5173), API-Calls werden über /api per Proxy weitergeleitet.
// In Produktion wird dieselbe Origin verwendet.
export const API_BASE_URL = import.meta.env.DEV
    ? `${window.location.origin}/api`
    : window.location.origin;
