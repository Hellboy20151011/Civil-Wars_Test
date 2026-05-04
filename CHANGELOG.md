# Changelog

Alle nennenswerten Änderungen an diesem Projekt werden hier dokumentiert.

Format: [Keep a Changelog](https://keepachangelog.com/de/1.0.0/)  
Versioning: [Semantic Versioning](https://semver.org/lang/de/)

---

## [Unreleased]

### Added

- `backend/database/schemas/combat_missions.sql` – neue Tabellen `combat_missions` und `combat_mission_units` für distanzbasierte Kampf-Missionen zwischen Spielern; unterstützt Lebenszyklus `traveling_to → in_combat → traveling_back → completed`
- `backend/repositories/combat-missions.repository.js` – Repository für Kampf-Missionen: Erstellen, Tick-Abfragen (ankommend/zurückkehrend), Status-Updates, Einheiten-Verwaltung, Spieler-Dashboard und Kampfhistorie
- `backend/services/combat.service.js` – Kampf-Service: `launchAttack()`, `processArrivingMissions()`, `processReturningMissions()` für das Tick-System
- `backend/routes/combat.js` – neue Routen: `POST /combat/attack`, `GET /combat/missions`, `GET /combat/incoming`, `GET /combat/history`
- `backend/database/schemas/users.sql` – Spalten `failed_login_attempts` und `locked_until` für Account-Lockout
- `backend/scripts/resetdb.js` – `combat_missions.sql` in die Schema-Ladereihenfolge aufgenommen
- `backend/database/migrate_v2_combat.sql` – Migrations-Skript für neue Spalten und Kampf-Tabellen
- `backend/repositories/units.repository.js` – neue Methoden `decrementUserUnitQuantity`, `addUnitQuantity`, `setUserUnitQuantity`, `setUnitHealth`, `findCombatUnitsByUser` für Kampfsystem
- `backend/services/gameloop.js` – ruft `combatService.processArrivingMissions()` und `processReturningMissions()` auf
- `backend/server.js` – `/combat`-Router registriert
- `backend/config.js` – neue Sektion `security` mit `maxFailedLogins` und `lockoutDurationMs`
- `backend/.env.example` – neue Variablen `MAX_FAILED_LOGINS` und `LOCKOUT_DURATION_MS` dokumentiert
- `backend/services/live-updates.service.js` – `broadcastToUser(userId, event, data)` für gezielte SSE-Events; SSE-Client-Management
- `frontend/scripts/shell.js` – `showToast(message, type)` hinzugefügt; SSE-Handler für `combat_incoming`, `combat_result`, `combat_return`
- `frontend/CSS/style.css` – CSS für `#toast-container`, `.toast`-Varianten und `#attack-panel`
- `frontend/pages/karte.html` – `#attack-panel` mit Ziel-Info, Einheitenliste und Angriffs-Button
- `frontend/scripts/karte.js` – Klick-Handler auf Canvas, `openAttackPanel()`, `closeAttackPanel()`, Launch-Button-Logik mit POST auf `/combat/attack`
- `backend/tests/e2e/auth-flow.test.js` – Playwright API-E2E-Tests: Register, Login, Authentifizierungsschutz, Startressourcen
- `backend/tests/e2e/buildings-flow.test.js` – Playwright API-E2E-Tests: Gebäudetypen, Startgebäude, Bau-Flow, vollständiger Spiel-Flow
- `backend/playwright.config.js` – Playwright-Konfiguration für API-E2E-Tests
- `backend/vitest.config.js` – Coverage-Konfiguration mit V8-Provider und Schwellen (≥80 % Statements/Lines/Functions, ≥60 % Branches)
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
- `backend/repositories/transaction.repository.js` – zentrale Transaktions-Hilfe (`withTransaction`)
- `frontend/scripts/ui/component.js` – schlanke Komponenten-Helfer (`el`, `render`, `clear`)
- `frontend/package.json` und `frontend/vite.config.js` – Vite Multi-Page-Build für `index`, `dashboard`, `bauhof`, `militaer`
- `backend/repositories/reference-data.repository.js` – TTL-Cache für Stammdaten (`building_types`, `unit_types`, `resource_types`)
- `frontend/eslint.config.js` – ESLint-Konfiguration für Frontend-Skripte
- `backend/routes/docs.js` – Swagger-UI-Route für `GET /api-docs`
- `backend/database/schemas/refresh_tokens.sql` – Persistenz für Refresh-Tokens (inkl. Ablauf/Revoke/Rotation)
- `backend/repositories/refresh-token.repository.js` – DB-Zugriffe für Refresh-Token-Flow
- `backend/services/service-error.js` – Utility `createServiceError(message, status, code)` für typisierte Service-Fehler
- `backend/services/me.service.js` – Spielerstatus-Logik als dedizierter Service
- `backend/services/service-error.js` – Utility `createServiceError` jetzt mit vollständigem Fehlercode-Katalog (JSDoc) für alle Auth-, Gebäude-, Einheiten- und Kampf-Codes

### Changed

- `backend/services/live-updates.service.js` – neue Funktion `mountUserStream(userId, res)`: kapselt SSE-Header-Setup, Client-Registrierung und Initialstatus-Senden in einem Service-Aufruf
- `backend/routes/me.js` – SSE-Handler nutzt `mountUserStream`; Route enthält nur noch Auth-Prüfung und `req.on('close')`-Wiring
- `backend/services/buildings.service.js` – alle `throw new Error(...)` auf `createServiceError` mit stabilen Codes umgestellt (`BUILDING_TYPE_NOT_FOUND`, `BUILDING_NOT_FOUND`, `BUILDING_MAX_LEVEL`, `INSUFFICIENT_RESOURCES`, `INSUFFICIENT_POWER`)
- `docs/Projektanalyse_2026-05-04.md` – Strukturverbesserungen als ✅ markiert
- `docs/Verbesserungs.md` – Abschnitt „8. Gameplay-Logik" ergänzt; erledigte Punkte (Repository-Pattern, Performance, Frontend-Lint, Hot-Reload, OpenAPI, Logging, Tests) als ✅ markiert
- `docs/Vorgaben/Anpassungen.md` – von `docs/` nach `docs/Vorgaben/` verschoben
- `docs/Vorgaben/Units.md` – Vollständige Neudokumentation aller 29 Einheiten mit aktuellen Werten und Beschreibungen
- `backend/routes/me.js` – DB-/Transaktionslogik an `me.service.js` delegiert; SSE-Fehler via `throw err` an zentralen `errorHandler`
- `backend/repositories/building.repository.js` – `TICK_MS` nutzt `config.gameloop.tickIntervalMs` statt direktem `process.env`-Zugriff
- `backend/routes/auth.js` und `backend/services/auth.service.js` – Authentifizierungs- und Token-Flows in Service-Schicht verlagert
- `backend/routes/buildings.js` und `backend/services/buildings.service.js` – Bau-/Queue-/Status-Logik in Service-Schicht verlagert
- `backend/routes/units.js` und `backend/services/units.service.js` – Fehlerbehandlung auf `createServiceError`-Muster umgestellt
- `backend/routes/combat.js` und `backend/services/combat.service.js` – `launchAttack`-Validierung auf `createServiceError` mit semantischen Codes umgestellt
- `backend/database/schemas/units.sql` – Kompletter Einheiten-Umbau: Spionage entfernt; neue Infanterie-, Fahrzeug-, Marine-, Luftwaffe- und Verteidigungs-Einheiten (29 Einheiten gesamt)
- `backend/database/schemas/building_types.sql` – Militärgebäude auf Level 5 erweitert; Beschreibungen auf neue Einheitennamen angepasst
- `backend/services/combat.service.js` – Einheitennamen aktualisiert (`Pionier` → `Panzergrenadier`, `Minentaucher` → `Kampftaucher`); hartes Matchup-System, Kampftaucher-Phase, Counter-Unit-Bonus (+30 %)
- `backend/repositories/combat-missions.repository.js` – `findMissionUnits` gibt `category` und `counter_unit` zurück
- `backend/repositories/units.repository.js` – `findCombatUnitsByUser` gibt `category` und `counter_unit` zurück; Login-Lockout-Logik
- `backend/repositories/player.repository.js` – `findByUsername` gibt `failed_login_attempts` und `locked_until` zurück; `findAllForMap()` ergänzt
- `frontend/scripts/militaer.js` – Spionage-Kategorie entfernt; Infanterie-Beschreibung aktualisiert
- `frontend/scripts/shell.js` – Spionage entfernt; "Karte" in Navigation; `globalThis.requestAnimationFrame()`
- `backend/server.js` – Map-Route registriert; statische Auslieferung bevorzugt `frontend/dist`; redundantes `dotenv.config()` entfernt
- `frontend/vite.config.js` – `karte`-Seite in Multi-Page-Build; Dev-Server auf Port `5173`
- `backend/config.js` – `map.gridSize`, `map.maxPlayers` konfigurierbar; `CORS_ORIGIN` unterstützt komma-separierte Origins; lädt `.env` selbst
- `backend/services/economy.service.js`, `backend/services/units.service.js`, `backend/services/gameloop-scheduler.js` – JSDoc ergänzt
- `backend/tests/services/units.service.test.js` – Testfall für `arriveAtDestination` ergänzt
- `backend/logger.js`, `backend/server.js`, `backend/middleware/errorHandler.js`, `backend/services/gameloop-scheduler.js` – strukturiertes Logging mit `pino`/`pino-http`
- `backend/services/gameloop.js` – `console.log`/`console.error` durch zentralen Logger ersetzt
- `backend/scripts/free-port.js` – ESLint-Fehler (`no-useless-assignment`) durch leeren `catch`-Block behoben
- `backend/services/gameloop-scheduler.js` – Promise-`.catch()`-Ketten auf `async/await` umgestellt
- `backend/services/buildings.service.js`, `backend/services/units.service.js`, `backend/services/gameloop.js` – DB-Zugriffe auf Repository-Pattern umgestellt
- `backend/repositories/building.repository.js` – Batch-Inserts für Gebäude/Bauqueue
- `backend/repositories/resources.repository.js` – Resource-Type-Lookups beschleunigt; Startressourcen als Batch-Upsert
- `backend/repositories/units.repository.js` – Unit-Type-Lookups auf Stammdaten-Cache umgestellt
- `backend/middleware/errorHandler.js` – Fehlerantworten enthalten jetzt `error.code`
- `backend/routes/auth.js`, `docs/openapi.yaml` – Refresh-Token-Mechanismus mit Rotation implementiert und dokumentiert
- `frontend/scripts/main.js`, `frontend/scripts/dashboard.js`, `frontend/scripts/bauhof.js`, `frontend/scripts/militaer.js`, `frontend/scripts/shell.js` – vollständig auf Komponentenbasis umgestellt; `API_BASE_URL` aus `config.js`
- `CONTRIBUTING.md` – Semantic-Versioning-Regeln und Branch-Schutz-Regeln dokumentiert
- `VARIABLES.md` – `iron_cost`/`iron_production` → `steel_cost`/`steel_production`
- `backend/.env.example` – `CORS_ORIGIN`, `POOL_MAX`, Rate-Limit-, Gameloop- und `REFERENCE_DATA_CACHE_TTL_MS`-Variablen dokumentiert
- `docs/next-steps.md` – erledigte Punkte als ✅ markiert

### Fixed

- `backend/routes/buildings.js` – Level-Gebäude erfordern zwingend das direkte Vorgängerlevel (`X-1`); Kategorien `military`/`government` erfordern vollständige Produktionsketten
- `backend/routes/auth.js` / `backend/services/auth.service.js` – Refresh-Token in derselben Transaktion wie User- und Startdaten gespeichert (keine partielle Persistenz)
- `backend/middleware/validate.js` – `result.error.errors` → `result.error.issues` (Zod v4); Validierungsfehler geben korrekt 400 statt 500 zurück
- `backend/vitest.config.js` – `test.env.JWT_SECRET` gesetzt; `tests/e2e/**` von Vitest-Ausführung ausgeschlossen
- `backend/middleware/rateLimiters.js` – Rate-Limiter in `NODE_ENV=test` und für Playwright-Requests außerhalb von `production` übersprungen
- `.github/workflows/ci.yml` – `JWT_SECRET` Umgebungsvariable für Backend-Lint-&-Test-Job ergänzt
- Hardcodierter Datenbankpasswort-Default (`1234`) in `db.js` entfernt

### Security

- `.github/copilot-instructions.md` – Regel für parametrierte SQL-Queries ergänzt
- `backend/package.json` / `backend/package-lock.json` – `bcrypt` auf `^6.0.0` aktualisiert (transitive `tar`-Schwachstelle entfällt)
- `backend/server.js` – CORS auf `CORS_ORIGIN`-Umgebungsvariable eingeschränkt
- `backend/middleware/rateLimiters.js` – Rate-Limit-Werte via `.env` konfigurierbar
- `.github/workflows/ci.yml` – Security-Audit-Step (`npm audit --audit-level=high`) und E2E-Job mit postgres:16-Service-Container ergänzt
- `.github/dependabot.yml` – Ecosystems für `/frontend` (npm) und `/` (github-actions) ergänzt
- `.gitignore` – `backend/coverage/`, `backend/playwright-report/`, `backend/test-results/` ausgeschlossen
- `backend/package.json` – `test:coverage`- und `test:e2e`-Script; `dev:full` räumt Dev-Ports automatisch auf
- `frontend/package.json` – `lint`-Script und ESLint-DevDependencies ergänzt

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
