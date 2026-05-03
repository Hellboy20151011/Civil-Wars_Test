# Civil Wars – Copilot Instructions

## Changelog

Wann immer Code oder Konfiguration geändert wird, muss `CHANGELOG.md` unter
`## [Unreleased]` aktualisiert werden:
- `Added` – neue Dateien/Features
- `Changed` – Änderungen an bestehenden Dateien
- `Fixed` – Bug Fixes
- `Security` – Security-relevante Änderungen

## Projekt-Konventionen

- Backend-Konfiguration immer über `backend/config.js` (nicht direkt `process.env`)
- Neue konfigurierbare Werte immer auch in `backend/.env.example` dokumentieren
- Fehler in Routen immer via `next(err)` an den zentralen `errorHandler` delegieren,
  kein direktes `res.status(...).json(...)` für Serverfehler (4xx durch Validierung ist OK)
- Neue DB-Abfragen gehören in `backend/repositories/`, nicht direkt in Services
- Kein Hardcode von `http://localhost:3000` im Frontend – `frontend/scripts/config.js` verwenden

## Sprache / Naming

- DB-Spalten, API-Felder, JS-Variablen: Englisch (außer bestehende DE-Felder wie `geld`, `stein`, `stahl`, `treibstoff`, `strom`)
- UI-Texte und Benutzeranzeigen: Deutsch

## Dokumentation

- Nach größeren Änderungen `docs/next-steps.md` und `docs/Verbesserungs.md` auf
  erledigte Punkte prüfen und mit ✅ markieren

## Architektur

Schichten (von außen nach innen):
1. `routes/` – HTTP-Handler, kein Business-Logic
2. `services/` – Business-Logic
3. `repositories/` – alle DB-Zugriffe
4. `database/db.js` – Connection Pool (nur von Repositories importieren)

## Projekt-Struktur

Siehe `README.md` und `CONTRIBUTING.md` für Setup und Workflow.  
API-Dokumentation: `API_DOCUMENTATION.md`  
DB-Schema und Variablen: `VARIABLES.md`
