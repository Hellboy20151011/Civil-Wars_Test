# Changelog

Alle nennenswerten Änderungen an diesem Projekt werden hier dokumentiert.

Format: [Keep a Changelog](https://keepachangelog.com/de/1.0.0/)  
Versioning: [Semantic Versioning](https://semver.org/lang/de/)

---

## [Unreleased]

### Added

- `backend/utils/game-math.js` – gemeinsame Hilfsfunktionen `calcDistance()` und `calcArrivalTime()` (P5: DRY-Refactor aus combat/espionage)
- `backend/tests/services/combat.service.test.js` – 18 Unit-Tests für combat.service.js (P1: Matchup-Logik, Kampftaucher-Sonderregel, Fehlerbehandlung, Rückkehr-Abschluss)
- `backend/tests/services/espionage.service.test.js` – 20 Unit-Tests für espionage.service.js (P1: Missions-Validierung, Erfolgsformel, Berichte, Preview)
- `.github/CODEOWNERS` – automatische Reviewer-Zuweisung für alle Pull Requests (P6)

### Fixed

- `.github/workflows/ci.yml` – `actions/checkout` und `actions/setup-node` von nicht-existenter `@v6` auf stabile `@v4` korrigiert (CI-Fehler behoben)
- `.github/workflows/release.yml` – gleiche Korrektur wie `ci.yml`

### Changed

- `backend/services/economy.service.js` – `TICK_MS` wird jetzt aus `config.gameloop.tickIntervalMs` gelesen statt hardcoded 60 s (P4)
- `backend/services/combat.service.js` – `calcDistance`/`calcArrivalTime` durch Import aus `utils/game-math.js` ersetzt; unbenutzten `config`-Import entfernt (P5)
- `backend/services/espionage.service.js` – `calcDistance`/`calcArrivalTime` durch Import aus `utils/game-math.js` ersetzt (P5)
- `backend/services/live-updates.service.js` – Stream-Ticket-System hinzugefügt: `createStreamTicket()` und `redeemStreamTicket()` für kurzlebige SSE-Einmal-Token (P2)
- `backend/routes/me.js` – SSE-Authentifizierung von JWT-im-URL auf `POST /me/stream-ticket` + `?ticket=` umgestellt; JWT-Import entfernt (P2)
- `backend/routes/auth.js` – direkte `res.status(error.status).json(...)` durch `next(err)` via `asyncWrapper` ersetzt (P3)
- `backend/routes/combat.js` – direkte Fehlerantworten durch Weitergabe an `errorHandler` über `asyncWrapper` ersetzt (P3)
- `backend/routes/espionage.js` – direkte Fehlerantworten durch Weitergabe an `errorHandler` über `asyncWrapper` ersetzt (P3)
- `backend/routes/units.js` – direkte Fehlerantworten durch Weitergabe an `errorHandler` über `asyncWrapper` ersetzt (P3)
- `frontend/scripts/shell.js` – `startLiveUpdates()` holt nun zuerst ein kurzlebiges Ticket via `POST /me/stream-ticket` statt den JWT im URL zu übergeben (P2)
- `.github/workflows/ci.yml` – `permissions: contents: read` auf Workflow-Ebene gesetzt (P8); Playwright-Browser-Installation `npx playwright install --with-deps chromium` im E2E-Job ergänzt (P7)
- `docker-compose.yml` – `POSTGRES_PASSWORD` auf `${POSTGRES_PASSWORD:-postgres}` umgestellt (P9)
- `backend/.env.example` – `POSTGRES_PASSWORD`-Hinweis für Docker Compose ergänzt (P9)
- `backend/tests/services/economy.service.test.js` – `TICK_MS` wird jetzt aus `config.gameloop.tickIntervalMs` importiert statt hardcoded

- `docs/Projektanalyse_2026-05-05.md` – tiefes Architektur- & Qualitäts-Review mit Top-10-Prioritätenliste

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
- `backend/database/schemas/spy_missions.sql` – neue Tabellen `spy_missions` und `spy_mission_units`; Status-Enum: `traveling_to`, `spying`, `traveling_back`, `completed`, `aborted`
- `backend/database/migrate_v3_espionage.sql` – Migrations-Skript für Spionage-Tabellen und Intel-Einheiten
- `backend/repositories/spy-missions.repository.js` – vollständiges Repository für Spionage-Missionen: Erstellen, Tick-Abfragen, Berichte, Intel/Counter-Intel-Level, Zusammenfassungen
- `backend/services/espionage.service.js` – Geschäftslogik für Spionage: `launchSpyMission`, `processArrivingSpyMissions`, `processReturningSpyMissions`, `getActiveMissions`, `getReports`, `getMissionPreview`; Erfolgsformel basiert auf Intel-/Counter-Intel-Level; 3 Detailstufen im Bericht
- `backend/routes/espionage.js` – neue Routen: `POST /espionage/launch`, `GET /espionage/preview`, `GET /espionage/missions`, `GET /espionage/reports`
- `frontend/pages/spionage.html` – neue Seite mit Tabs: laufende Missionen und Spionageberichte
- `frontend/scripts/spionage.js` – lädt und rendert Missionen/Berichte; reagiert auf SSE-Event `spy-return`; Auto-Refresh alle 30 Sekunden
- `frontend/pages/geheimdienstzentrum.html` – neue Seite zum Ausbilden von Geheimdiensteinheiten (`intel`-Kategorie: Spion, SR-71 Aufklärer, Spionagesatellit)
- `frontend/scripts/geheimdienstzentrum.js` – lädt `intel`-Einheiten, zeigt Freischaltungsstatus je nach Geheimdienstzentrum-Level, ermöglicht Training per `/units/train`
- `frontend/CSS/style.css` – neue Styles für Geheimdienstzentrum-Seite: `.gdh-level-info`, `.gdh-locked`, `.gdh-owned`

### Fixed

- `backend/services/espionage.service.js` – `processArrivingSpyMissions` und `processReturningSpyMissions` verarbeiten jede Mission in einer eigenen Transaktion (Isolation), sodass ein Fehler bei einer Mission nicht alle anderen abbricht
- `backend/services/espionage.service.js` – unbenutztes `bestUnitName`-Variablen entfernt
- `backend/repositories/spy-missions.repository.js` – `is_under_construction` → `is_constructing` in `findIntelLevel`, `findCounterIntelLevel` und `findBuildingSummaryForReport`
- `backend/repositories/spy-missions.repository.js` – `FOR UPDATE OF sm` aus `findArrivingMissions` und `findReturningMissions` entfernt (kein Effekt außerhalb einer Transaktion); stattdessen Status-Guard in `setMissionResult` (`AND status = 'traveling_to'`) und `completeMission` (`AND status = 'traveling_back'`) gegen Doppelverarbeitung
- `backend/services/gameloop-scheduler.js` – `combatService.processArrivingMissions/processReturningMissions` und `espionageService.processArrivingSpyMissions/processReturningSpyMissions` werden im Tick aufgerufen
- `backend/services/buildings.service.js` – Öl-Raffinerie kann nicht mehr ohne Ölpumpe gebaut werden; Verhältnis-Prüfung: max. 5 Öl-Raffinerien pro vorhandener Ölpumpe (`BUILDING_RATIO_EXCEEDED`)
- `frontend/scripts/spionage.js` – Auto-Refresh der Missionsanzeige von 5s auf 2s verkürzt, damit Missionen schneller als "completed" angezeigt werden

- `frontend/scripts/dashboard.js` – Dashboard vollständig überarbeitet: Gebäude-Übersicht nach Kategorie mit Anzahl-Badge, Einheiten-Übersicht nach Kategorie mit HP-Balken und „Unterwegs"-Badge, Bauwarteschlange mit Fortschrittsbalken und Countdown; Zweispalten-Layout; Countdown auf `requestAnimationFrame` umgestellt (kein Flackern mehr); Queue wird per SSE automatisch aktualisiert wenn ein Bau fertig ist
- `frontend/CSS/style.css` – neue Dashboard-Styles: `.dash-columns`, `.dash-section`, `.dash-building-group`, `.dash-unit-row`, `.dash-hp-bar`, `.dash-progress-bar`, `.dash-queue-item`
- `backend/repositories/spy-missions.repository.js` – `import { db }` → `import pool` (Exportname-Fix für `db.js`)
- `backend/routes/me.js` – SSE-Handler nutzt `mountUserStream`; Route enthält nur noch Auth-Prüfung und `req.on('close')`-Wiring
- `backend/services/buildings.service.js` – alle `throw new Error(...)` auf `createServiceError` mit stabilen Codes umgestellt
- `backend/services/gameloop.js` – ruft `espionageService.processArrivingSpyMissions()` und `processReturningSpyMissions()` im Tick auf
- `backend/server.js` – `/espionage`-Router registriert
- `backend/middleware/validate.js` – `validateQuery(schema)` ergänzt (analog zu `validateBody`)
- `backend/database/schemas/units.sql` – 3 neue Intel-Einheiten: `Spion`, `SR-71 Aufklärer`, `Spionagesatellit`
- `backend/scripts/resetdb.js` – `spy_missions.sql` in Schema-Ladereihenfolge aufgenommen
- `frontend/pages/karte.html` – altes `#attack-panel` durch 3 Panels ersetzt: `#action-panel` (Auswahl), `#attack-panel` (Angriff), `#spy-panel` (Spionage)
- `frontend/scripts/karte.js` – Panel-Logik überarbeitet: `closeAllPanels()`, `openActionPanel()`, `openSpyPanel()` mit Live-Vorschau via `/espionage/preview`
- `frontend/scripts/shell.js` – `Spionage` in Navigation; SSE-Handler für `spy_detected`, `spy_mission_update`, `spy_return`; `spy-return` Custom-Event für Spionage-Seite; Geheimdienstzentrum-Navlink wird dynamisch eingeblendet sobald Gebäude vorhanden; `renderSidebar` erhält `status` von `/me` nach dem Fetch
- `frontend/vite.config.js` – `spionage` und `geheimdienstzentrum`-Seiten in Multi-Page-Build
- `frontend/CSS/style.css` – Styles für `#action-panel`, `#spy-panel`, `.action-buttons`, `.spy-*`-Klassen für Spionage-Seite
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
