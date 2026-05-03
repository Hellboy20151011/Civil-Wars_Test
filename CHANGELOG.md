# Changelog

Alle nennenswerten Änderungen an diesem Projekt werden hier dokumentiert.

Format: [Keep a Changelog](https://keepachangelog.com/de/1.0.0/)  
Versioning: [Semantic Versioning](https://semver.org/lang/de/)

---

## [Unreleased]

### Added
- `backend/tests/services/units.service.test.js` – 18 Unit-Tests für `units.service.js` (Getter, startTraining, moveUnits, attackUnits)
- `backend/tests/services/gameloop-scheduler.test.js` – 7 Unit-Tests für `gameloop-scheduler.js` (executeGameTick, getTickStats, startGameLoop)
- `backend/tests/e2e/auth-flow.test.js` – Playwright API-E2E-Tests: Register, Login, Authentifizierungsschutz, Startressourcen
- `backend/tests/e2e/buildings-flow.test.js` – Playwright API-E2E-Tests: Gebäudetypen, Startgebäude, Bau-Flow, vollständiger Spiel-Flow
- `backend/playwright.config.js` – Playwright-Konfiguration für API-E2E-Tests
- `backend/vitest.config.js` – Coverage-Konfiguration mit V8-Provider und Schwellen (Statements/Lines/Functions ≥80 %, Branches ≥60 %)
- `backend/config.js` – zentrale Konfigurationsschicht mit Startup-Validierung (JWT-Secret-Länge, fehlende Env-Vars)
- `frontend/scripts/config.js` – zentrale API-URL für alle Frontend-Skripte
- `.editorconfig` – einheitliche Editor-Grundeinstellungen im Root
- `.github/pull_request_template.md` – PR-Vorlage
- `.github/ISSUE_TEMPLATE/bug_report.yml` – strukturiertes Bug-Report-Template
- `.github/ISSUE_TEMPLATE/feature_request.yml` – Feature-Request-Template
- `CONTRIBUTING.md` – Onboarding-Anleitung für Beitragende
- `LICENSE` – MIT-Lizenz
- `docs/openapi.yaml` – erste maschinenlesbare OpenAPI-3.0-Spezifikation für die aktuellen API-Routen
- `docs/architecture.md` – Architekturuebersicht mit Schichtenmodell, Laufzeitfluss und Querschnittsthemen
- `docker-compose.yml` + `backend/Dockerfile` – lokales Setup mit Docker
- `backend/repositories/units.repository.js` – Einheiten-Abfragen/Updates zentralisiert
- `backend/repositories/transaction.repository.js` – zentrale Transaktions-Hilfe (`withTransaction`)
- `frontend/scripts/ui/component.js` – schlanke Komponenten-Helfer (`el`, `render`, `clear`) für deklaratives UI-Rendering
- `backend/services/live-updates.service.js` – SSE-Client-Management und Broadcast für Live-Statusupdates
- `frontend/package.json` und `frontend/vite.config.js` – Vite Multi-Page-Build für `index`, `dashboard`, `bauhof`, `militaer`
- `backend/repositories/reference-data.repository.js` – TTL-Cache für häufig gelesene Stammdaten (`building_types`, `unit_types`, `resource_types`)
- `frontend/eslint.config.js` – ESLint-Konfiguration für Frontend-Skripte

### Changed
- `backend/services/economy.service.js`, `backend/services/units.service.js`, `backend/services/gameloop-scheduler.js` und `backend/routes/auth.js` – JSDoc für kritische Tick-/Kampf-/Auth-Funktionen ergänzt (inkl. Parametern, Rückgaben und Seiteneffekten)

### Security
- `.github/copilot-instructions.md`: Regel für parametrierte SQL-Queries ergänzt (kein String-Concatenation in DB-Abfragen)
- `backend/package.json`: `test:coverage`- und `test:e2e`-Script ergänzt
- `backend/vitest.config.js`: `tests/e2e/**` von Vitest-Ausführung ausgeschlossen
- `.github/workflows/ci.yml`: Security-Audit-Step (`npm audit --audit-level=high`) nach Coverage ergänzt; E2E-Job mit postgres:16-Service-Container und `wait-on` ergänzt
- `.github/dependabot.yml`: Ecosystems für `/frontend` (npm) und `/` (github-actions) ergänzt
- `CONTRIBUTING.md`: Abschnitt „Branch-Schutz-Regeln" mit konkreten GitHub-Einstellungen ergänzt
- `.gitignore`: `backend/coverage/`, `backend/playwright-report/`, `backend/test-results/` ausgeschlossen
- `backend/scripts/free-port.js` und `backend/package.json` – `dev:full` räumt die Dev-Ports `3000` und `5173` automatisch vor dem Start auf, um `EADDRINUSE` im Dev-Workflow zu vermeiden
- `frontend/scripts/main.js`, `frontend/scripts/shell.js`, `frontend/scripts/bauhof.js`, `frontend/scripts/militaer.js` – Navigation/Sidebar auf Vite-Multi-Page-Routen (`/pages/*.html`) angepasst und Legacy-Pfade weiterhin unterstützt
- `backend/package.json` – neuer `dev:full`-Workflow startet Backend-Watch und Vite-Dev-Server parallel (Hot Reload)
- `frontend/vite.config.js` – Dev-Server auf Port `5173` mit Auto-Open von `pages/index.html` für schnelleren Frontend-Loop
- `backend/config.js` und `backend/.env.example` – `CORS_ORIGIN` unterstützt mehrere komma-separierte Origins (u. a. `http://localhost:5173`)
- `backend/server.js` – CORS auf `CORS_ORIGIN`-Umgebungsvariable eingeschränkt (Security)
- `backend/middleware/rateLimiters.js` – Rate-Limit-Werte via `.env` konfigurierbar
- `backend/middleware/errorHandler.js` – Fehlerantworten enthalten jetzt `error.code`
- `backend/.env.example` – `CORS_ORIGIN`, `POOL_MAX`, Rate-Limit- und Gameloop-Variablen dokumentiert
- `VARIABLES.md` – `iron_cost`/`iron_production` → `steel_cost`/`steel_production` (Naming-Konsistenz)
- Alle Frontend-Skripte lesen `API_BASE_URL` aus `config.js` statt Hardcode
- `backend/services/gameloop-scheduler.js` – verbliebene Promise-`.catch(...)`-Ketten auf `async/await` mit `try/catch` umgestellt
- `backend/services/buildings.service.js`, `backend/services/units.service.js`, `backend/services/gameloop.js`, `backend/services/gameloop-scheduler.js` – DB-Zugriffe auf Repository-Pattern umgestellt
- `backend/repositories/building.repository.js` und `backend/repositories/player.repository.js` – zusätzliche Methoden für Service-Refactor ergänzt
- `docs/Verbesserungs.md` und `docs/next-steps.md` – Fortschritt für Repository-Pattern auf erledigt gesetzt
- `frontend/scripts/main.js`, `frontend/scripts/dashboard.js`, `frontend/scripts/bauhof.js`, `frontend/scripts/militaer.js`, `frontend/scripts/shell.js` – vollständig auf Komponentenbasis statt rein imperativer DOM-Erzeugung umgestellt
- `backend/config.js` lädt `.env` jetzt selbst via `dotenv/config`, damit ESM-Importreihenfolge keine fehlenden Env-Variablen verursacht
- `backend/server.js` – redundantes spätes `dotenv.config()` entfernt
- `backend/routes/me.js` und `frontend/scripts/shell.js` – Echtzeit-Statusupdates via SSE (`/me/stream`) statt reinem Pull-Ansatz
- `backend/repositories/building.repository.js` – Batch-Inserts für Gebäude/Bauqueue statt Insert-Schleifen
- `backend/repositories/resources.repository.js` – Resource-Type-Lookups beschleunigt und Startressourcen als Batch-Upsert umgesetzt
- `backend/repositories/units.repository.js` – Unit-Type-Lookups auf Stammdaten-Cache umgestellt
- `backend/config.js` und `backend/.env.example` – `REFERENCE_DATA_CACHE_TTL_MS` für Cache-TTL ergänzt
- `docs/Verbesserungs.md` und `docs/next-steps.md` – Performance-Punkt 3.1 auf erledigt gesetzt
- `backend/server.js` – statische Auslieferung nutzt bevorzugt `frontend/dist` (Build), sonst `frontend/`
- `README.md`, `docs/Verbesserungs.md` und `docs/next-steps.md` – Frontend-Bundling mit Vite dokumentiert und als erledigt markiert
- `.github/workflows/ci.yml` – separater Frontend-Build-Job (`npm ci` + `npm run build`) ergänzt
- `frontend/package.json` – `lint`-Script und ESLint-DevDependencies ergänzt
- `.github/workflows/ci.yml` – separater Frontend-Lint-Job (`npm ci` + `npm run lint`) ergänzt
- `docs/Verbesserungs.md` und `docs/next-steps.md` – Frontend-Lint in CI als erledigt markiert
- `README.md`, `docs/Verbesserungs.md` und `docs/next-steps.md` – Hot-Reload-Dev-Workflow dokumentiert und als erledigt markiert
- `docs/Verbesserungs.md` und `docs/next-steps.md` – Dokumentationspunkt 8.2 bzw. OpenAPI-Teilaufgabe auf erledigt aktualisiert
- `CONTRIBUTING.md`, `docs/Verbesserungs.md` und `docs/next-steps.md` – verbindliche Semantic-Versioning-Regeln dokumentiert und Fortschritt auf erledigt gesetzt

### Fixed
- Hardcodierter Datenbankpasswort-Default (`1234`) in `db.js` entfernt

### Security
- `backend/package.json` / `backend/package-lock.json` – `bcrypt` auf `^6.0.0` aktualisiert, wodurch die transitive `tar`-Schwachstelle (über `@mapbox/node-pre-gyp`) entfällt

---

## [1.0.0] – 2026-05-03

### Added
- Express-Backend mit JWT-Authentifizierung
- Ressourcen-System (Geld, Stein, Stahl, Treibstoff, Strom)
- Gebäude-System mit Bauwarteschlange und Upgrade-Logik
- Einheiten-System (Ausbildung, Bewegung)
- Tick-basierter Gameloop-Scheduler
- PostgreSQL-Datenbank mit vollständigem Schema
- Zod-Validierung für alle API-Endpunkte
- Rate-Limiting für Auth- und API-Routen
- Vanilla-JS-Frontend (Dashboard, Bauhof, Militär)
- Vollständige API-Dokumentation (`API_DOCUMENTATION.md`)
