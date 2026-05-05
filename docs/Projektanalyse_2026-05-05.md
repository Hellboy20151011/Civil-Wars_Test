# Civil Wars – Tiefes Architektur- & Qualitäts-Review (Stand: 2026-05-05)

---

## 1) Projektüberblick

**Zweck/Scope:** *Civil Wars* ist ein tick-basiertes Browser-Strategiespiel (Genre: „Browsergame"). Spieler bauen eine Basis auf, produzieren Ressourcen, errichten Gebäude, bilden Militäreinheiten aus, greifen andere Spieler per distanzbasiertem Kampfsystem an und entsenden Spione. Das Spiel läuft vollständig im Browser; der Backend-Server dient als einzige Authority über Spielzustand und Tick-Logik.

**Versionsstand:** Release `1.0.0` (03.05.2026), danach ein umfangreiches `[Unreleased]`-Bundle mit Kampf-, Spionage- und Dashboard-Features (`CHANGELOG.md`).

**Hauptkomponenten:**

| Modul | Verantwortlichkeit |
|---|---|
| `backend/routes/` | HTTP-Handler (Express), Validierung, Auth |
| `backend/services/` | Business-Logik (Economy, Combat, Espionage, Auth, Me, Units, Buildings) |
| `backend/repositories/` | Alle DB-Zugriffe (parametrierte SQL, TTL-Cache für Stammdaten) |
| `backend/database/` | PostgreSQL-Schema-Dateien, Migrations-SQL, pg-Pool |
| `backend/middleware/` | asyncWrapper, errorHandler, rateLimiters, validate (Zod) |
| `frontend/pages/` | 7 HTML-Seiten (index, dashboard, Bauhof, militaer, karte, spionage, geheimdienstzentrum) |
| `frontend/scripts/` | Vanilla-JS-Module pro Seite + `shell.js` (SSE, Navigation, Toast) |
| `backend/services/gameloop-scheduler.js` | Tick-Orchestrator (Economy, Kampf, Spionage) |
| `backend/services/live-updates.service.js` | Server-Sent Events (SSE) – Echtzeit-Push an Clients |

---

## 2) Code- und Architektur-Analyse

### 2.1 Projektstruktur und Entry Points

Der Einstiegspunkt ist `backend/server.js`. Dort werden alle Router registriert, statische Frontend-Assets ausgeliefert (`frontend/dist` bevorzugt, sonst `frontend/`), und der Game Loop gestartet:

```js
// server.js:78
startGameLoop(); // → gameloop-scheduler.js
app.listen(PORT, ...);
```

Die Konfiguration wird **ausschließlich** in `backend/config.js` gelesen und validiert. `JWT_SECRET < 32 Zeichen` wirft beim Import einen Fehler (`config.js:21-25`). `process.env`-Zugriffe außerhalb von `config.js` beschränken sich auf das Admin-Skript `scripts/resetdb.js` (kein Produktionscode) – das ist sauber.

**Schichtenarchitektur** (4-stufig, nach `docs/architecture.md`):
```
routes/ → services/ → repositories/ → database/db.js → PostgreSQL
```
Diese Trennung ist konsistent eingehalten. Repositories importieren ausschließlich den pg-Pool; Services greifen nie direkt auf `db.js` zu; Routes enthalten keine SQL.

### 2.2 Abhängigkeiten / Build-System

**Backend** (`backend/package.json`):

```
express:          ^5.2.1   (Express 5 – async error propagation nativ)
zod:              ^4.4.2   (Zod v4, breaking: .errors → .issues, bereits gefixt)
jsonwebtoken:     ^9.0.3
bcrypt:           ^6.0.0   (kürzlich aktualisiert – Security-Fix tar-Transitive)
pg:               ^8.12.0
pino / pino-http          (strukturiertes Logging)
```

**Wichtig:** Das Projekt nutzt **Express 5** (`^5.2.1`). Express 5 leitet async-Fehler direkt an den Error Handler weiter, ohne dass `asyncWrapper` streng nötig wäre – der Wrapper schadet nicht und macht den Code rückwärtskompatibel.

**Frontend** (`frontend/package.json`): Reines Vite-Build-System, keine Laufzeit-Frameworks. Multi-Page-App (7 HTML-Seiten). Keine externen Runtime-Dependencies.

**Toolchain:** ESLint + Prettier (Backend und Frontend), Vitest (Unit), Playwright (E2E), Docker Compose.

### 2.3 Laufzeitfluss

**Authentifizierter Request:**
1. Route → `requireAuth` (JWT verify via `auth.js:91-104`) → `validateBody`/`validateQuery` (Zod) → `asyncWrapper` → Service → Repository → DB

**Tick-System (Herzstück des Spiels):**

`gameloop-scheduler.js:executeGameTick()` läuft im Intervall (Dev: 1 min, Prod: 10 min, konfigurierbar via `TICK_INTERVAL_MS`). Pro aktivem Spieler:

1. `economyService.applyProductionTicks()` – Ressourcenproduktion seit `last_updated` nachholen
2. `economyService.processFinishedQueue()` – fertige Bauaufträge abschließen
3. `economyService.getSpielerStatus()` → per SSE an verbundene Clients gesendet
4. Global: Kampf-Missionen (`combatService.processArrivingMissions/processReturningMissions`)
5. Global: Spionage-Missionen (`espionageService.processArrivingSpyMissions/processReturningSpyMissions`)

Die Tick-Sicherung ist solide: `gameLoopActive`-Flag verhindert gleichzeitige Ausführung (`gameloop-scheduler.js:27-29`). Jede Mission wird in einer eigenen Transaktion verarbeitet; ein Fehler bei einer Mission bricht andere nicht ab.

**SSE-Live-Updates:** `live-updates.service.js` verwaltet einen `Map<userId, Set<Response>>`. Heartbeats alle 25 Sekunden. Token-Übergabe via URL-Parameter (`/me/stream?token=...`), was eine Sicherheitsschwäche ist (Logs/Proxies können den Token sehen – mehr in Abschnitt 4).

### 2.4 Schnittstellen / Modularität

**Stärken:**
- Saubere Trennung Routes/Services/Repositories überall eingehalten
- `createServiceError(message, status, code)` (`service-error.js`) als einheitliches Fehler-Muster mit vollständigem JSDoc-Katalog aller Codes
- `withTransaction(work)` (`transaction.repository.js`) als sauberer Transaktions-Wrapper
- `asyncWrapper` verhindert vergessene try/catch in Routen
- `reference-data.repository.js` hat einen TTL-Cache (300 s) für Stammdaten – gut für Performance

**Schwächen:**

- **Doppelter Code:** `calcDistance()` und `calcArrivalTime()` sind identisch in `combat.service.js:80-101` und `espionage.service.js:34-42` definiert. Könnten in ein gemeinsames `utils/game-math.js` extrahiert werden.

- **`economy.service.js:5` – Hardcoded TICK_MS:**
  ```js
  const TICK_MS = 60 * 1000; // hardcoded 1 Minute
  ```
  Der konfigurierbare Wert `config.gameloop.tickIntervalMs` wird in `gameloop-scheduler.js` verwendet, aber `economy.service.js` ignoriert die Konfiguration. In Produktion (10 min Tick) würden damit immer 10 Ticks pro Tick verbucht – de facto korrekt, da `ticks = Math.floor(elapsed / TICK_MS)` die tatsächliche Produktionsgranularität beschreibt, aber inkonsistent zur restlichen Konfiguration.

- **Error-Handling-Inkonsistenz:** Die Konvention besagt `next(err)` für alle Serverfehler. Tatsächlich fangen mehrere Routen `error.status`-Fehler direkt ab und antworten mit `res.status(error.status).json(...)` (`auth.js:39-40`, `combat.js:40`, `espionage.js:49`). Das führt zu leicht unterschiedlichen Response-Strukturen (zentral: `{ message, error: { message, code, details } }`, direkt: nur `{ message }`).

- **`gameloop.js` und `gameloop-scheduler.js` koexistieren:** `gameloop.js` ist ein Überbleibsel (enthält `executeTick()` und `initializeNewPlayer()`). Der Scheduler (`gameloop-scheduler.js`) ist die aktive Implementierung. Diese Redundanz könnte Verwirrung stiften.

### 2.5 Fehlerbehandlung / Logging

**Fehlerbehandlung:**
- Zentraler `errorHandler` (`middleware/errorHandler.js`) gibt strukturierte JSON-Antworten mit `message`, `code` und `details`
- Nicht-5xx-Fehler (Business-Fehler via `createServiceError`) werden korrekt weitergegeben
- Validierungsfehler (Zod) antworten direkt mit 400 aus der Middleware (korrekt)

**Logging:**
- Strukturiertes Logging via `pino` / `pino-http` mit Request-ID-Propagation (`logger.js:22-29`)
- Log-Level via `LOG_LEVEL`-Env, Dev: `debug`, Prod: `info`
- Tick-Prozess loggt mit `child({ tickCounter, tickTime })` – sehr sauber
- `/health`-Endpoint wird aus auto-logging ausgenommen (`logger.js:38`)

**BOM-Zeichen:** Zwei Dateien enthalten ein UTF-8-BOM (`\xEF\xBB\xBF`): `backend/services/gameloop-scheduler.js` und `CHANGELOG.md`. Harmlos, aber inkonsistent.

### 2.6 Performance-Hotspots

- **Tick-Loop O(n×Queries):** Pro aktivem Spieler werden mehrere DB-Queries sequentiell ausgeführt. Bei vielen Spielern (>100) kann das zum Bottleneck werden.
- **SSE-Heartbeat:** Läuft alle 25 s für **alle** verbundenen Clients in einem `setInterval`. Bei vielen gleichzeitigen Verbindungen akkumuliert sich Overhead.
- **Reference-Data-Cache:** Korrekt implementiert, aber der Cache ist nicht nach `client` getrennt – bei Transaktionen mit einem nicht-Pool-Client wird dennoch der Pool-basierte Cache-Wert genutzt. In der Praxis harmlos.
- **Ressourcen ohne Obergrenze:** Es gibt kein `max_amount`-Cap in `user_resources`. Spieler akkumulieren unbegrenzt Ressourcen.

---

## 3) Qualität & Wartbarkeit

### 3.1 Tests

| Art | Dateien | Abdeckung |
|---|---|---|
| Unit (Vitest) | `economy.service.test.js`, `gameloop-scheduler.test.js`, `units.service.test.js` | Services: ≥80 % Lines/Functions (konfiguriert in `vitest.config.js:19-24`) |
| E2E (Playwright) | `auth-flow.test.js`, `buildings-flow.test.js` | Auth, Gebäude-Flow |

**Fehlende Tests:**
- `combat.service.js` (429 Zeilen!) und `espionage.service.js` (438 Zeilen!) haben **keine** Unit-Tests. Sie enthalten komplexe Kampfberechnungen (Matchup-Tabelle, Kampftaucher-Phase, Erfolgsformel).
- `buildings.service.js` ist explizit aus der Coverage ausgeschlossen (`vitest.config.js:15`) – trotz 429 Zeilen Kernlogik.
- `auth.service.js` hat keine direkten Unit-Tests (nur E2E-abgedeckt).
- Keine Frontend-Tests.

**Test-Qualität:** Die vorhandenen Unit-Tests sind gut strukturiert (Mocks für Repositories, klare Assertions). Die E2E-Tests decken realistische Flows ab (Register → Login → Token-Rotation → Auth-Guard).

### 3.2 Linting / Formatierung / CI

**CI-Pipeline** (`.github/workflows/ci.yml`):
- 4 Jobs: `backend` (Lint + Test + Coverage + Security Audit), `frontend-build`, `frontend-lint`, `e2e`
- E2E-Job nutzt postgres:16-Service-Container
- `npm audit --audit-level=high` als Security-Audit-Step
- Trigger: Push/PR auf `main`

**Dependabot** (`.github/dependabot.yml`): Wöchentliche Updates für `/backend`, `/frontend`, GitHub Actions.

**Linter:** ESLint + `eslint-config-prettier`. Regel `no-unused-vars: warn` mit `argsIgnorePattern: '^_'`.

**Potential:** Der E2E-CI-Job hat keinen `npx playwright install --with-deps`-Step. Auf frischen Runnern ohne vorinstallierten Browser können E2E-Tests fehlschlagen.

### 3.3 Dokumentation

**Stärken:**
- `README.md`: Vollständig (Setup, Docker, API, Struktur, Ressourcen-Tabelle)
- `CONTRIBUTING.md`: Branch-Konventionen, Commit-Style (Conventional Commits), Semantic Versioning, PR-Prozess, Branch-Protection-Empfehlungen
- `API_DOCUMENTATION.md`: Vollständige Endpunkt-Dokumentation
- `docs/openapi.yaml`: Maschinenlesbare OpenAPI-3.0-Spec (Swagger UI erreichbar via `/api-docs` in Dev)
- `docs/architecture.md`: Schichtenmodell, Laufzeitfluss, Querschnittsthemen
- `CHANGELOG.md`: Detailliert nach Keep a Changelog

**Lücken:**
- Keine ADRs (Architecture Decision Records)
- `docs/` enthält nicht-technische Dateien (`hallo.html`, `hallo.xls`, `BEWERTUNG.md`, `Issues.md`)

---

## 4) Sicherheit & Supply Chain

### 4.1 Secrets / Credentials

- **Keine `.env`-Datei committed** (`.gitignore` schließt `backend/.env` korrekt aus)
- **`docker-compose.yml:8`:** `POSTGRES_PASSWORD: postgres` – hardcodiertes Default-Passwort. In Produktion muss überschrieben werden.
- **`release.yml:57`:** `JWT_SECRET: test_secret_for_ci_only_minimum_32_chars` – klar als Test-Secret markiert, kein Problem
- Kein hardcodiertes Produktions-Secret gefunden
- `.env.example` enthält einen expliziten Hinweis zum Ändern des Secrets

### 4.2 SSE-Token im URL-Parameter

`GET /me/stream?token=<JWT>` (`me.js:27`) überträgt den Access-Token als Query-Parameter. Der Token erscheint in Server-Logs, Reverse-Proxy-Logs und Browser-Verlauf. Besser wäre die Übergabe als `Authorization`-Header oder ein kurzlebiges einmaliges Stream-Ticket.

### 4.3 Brute-Force-Schutz

Gut implementiert:
- `authLimiter` (15 min / 20 Requests, konfigurierbar)
- Account-Lockout nach `maxFailedLogins` fehlgeschlagenen Versuchen (`auth.service.js:113-119`) mit konfigurierbarer Dauer

### 4.4 SQL Injection

Alle DB-Abfragen verwenden parametrierte Queries (`$1, $2, ...` mit separatem Array). Kein String-Concatenation-SQL gefunden. Die Konvention ist in `docs/architecture.md:42` und `.github/copilot-instructions.md` explizit verankert.

### 4.5 CORS

Konfigurierbar via `CORS_ORIGIN` (komma-separiert). Standardmäßig auf `localhost:3000,localhost:5173` eingeschränkt. In Produktion muss auf die echte Domain gesetzt werden.

### 4.6 Dependency-Risiken / Lockfiles

- Beide `package-lock.json`-Dateien committed – gut für reproduzierbare Builds
- `npm audit --audit-level=high` im CI
- Dependabot für wöchentliche Updates aktiv
- `bcrypt@^6.0.0` schließt bekannte `tar`-Transitive-Schwachstelle aus

### 4.7 GitHub Actions – Permissions

- `release.yml` hat explizit `permissions: contents: write` – minimal für die Release-Erstellung
- ~~`ci.yml` hat **keine** explizite `permissions`-Deklaration~~ → ✅ `permissions: contents: read` auf Workflow-Ebene gesetzt

---

## 5) GitHub-Projekt-Hygiene

| Aspekt | Status |
|---|---|
| Lizenz | ✅ MIT (`LICENSE`) |
| README | ✅ Vollständig |
| CONTRIBUTING | ✅ Vorhanden, gut |
| CHANGELOG | ✅ Keep-a-Changelog-Format |
| PR-Template | ✅ `.github/pull_request_template.md` mit Checkliste |
| Issue-Templates | ✅ Bug Report, Feature Request, Neues Gebäude (3 YAML-Templates) |
| Dependabot | ✅ Backend, Frontend, GitHub Actions |
| CODEOWNERS | ✅ `.github/CODEOWNERS` angelegt (`* @Hellboy20151011`) |
| Releases | ❌ Kein Release veröffentlicht (nur `v1.0.0` im CHANGELOG geplant) |
| Branch-Schutz | ⚠️ Dokumentiert in `CONTRIBUTING.md:102-115`, aber muss manuell aktiviert werden |
| CI-Status | ✅ 4 Jobs (Backend Lint/Test/Coverage/Audit, Frontend Build, Frontend Lint, E2E) |
| E2E im CI | ✅ `npx playwright install --with-deps chromium` im E2E-Job ergänzt |

---

## 6) Konkrete Empfehlungen – Top 10 Prioritäten

### ✅ P1 – Tests für Combat und Espionage (kritisch)

`combat.service.js` (429 Zeilen) und `espionage.service.js` (438 Zeilen) haben **null Unit-Tests**. Sie enthalten komplexe Kampfberechnungen (Matchup-Tabelle, Kampftaucher-Phase, Erfolgsformel). Bugs hier sind spielkritisch und ohne Tests unsichtbar.

**Erledigt:** `backend/tests/services/combat.service.test.js` (18 Tests) und `backend/tests/services/espionage.service.test.js` (20 Tests) angelegt. Alle 75 Tests laufen durch.

---

### ✅ P2 – SSE-Token aus URL-Parameter entfernen

`GET /me/stream?token=...` (`me.js:27`) exponiert den JWT im URL. Auf Fetch-basierte SSE mit `Authorization`-Header oder ein kurzlebiges "Stream-Ticket" (einmaliges Server-seitiges Token) umstellen.

**Erledigt:** `POST /me/stream-ticket` (Bearer-Auth) gibt ein 30 s gültiges Einmal-Ticket aus. Der SSE-Endpunkt akzeptiert nun `?ticket=` statt `?token=`. Frontend `shell.js` holt zuerst das Ticket via `fetch`, dann öffnet die `EventSource`. JWT erscheint nicht mehr in Server-Logs.

---

### ✅ P3 – Error-Handling vollständig auf `next(err)` vereinheitlichen

In `auth.js`, `combat.js`, `espionage.js`, `units.js` wurden Service-Fehler direkt mit `res.status(error.status).json({message})` beantwortet, statt `next(error)`. Das umging den zentralen `errorHandler` und produzierte inkonsistente Response-Strukturen.

**Erledigt:** Alle `try/catch`-Blöcke mit direktem Response in den betroffenen Routen entfernt. Fehler laufen jetzt vollständig durch `asyncWrapper` → `errorHandler` und liefern einheitlich `{ message, error: { message, code, details } }`.

---

### ✅ P4 – `economy.service.js` – TICK_MS aus Config lesen

`const TICK_MS = 60 * 1000` (`economy.service.js:5`) war hardcoded.

**Erledigt:** `economy.service.js` importiert nun `config` und verwendet `config.gameloop.tickIntervalMs`. Der bestehende Test wurde ebenfalls auf `config.gameloop.tickIntervalMs` umgestellt.

---

### ✅ P5 – Gemeinsames `utils/game-math.js`

`calcDistance()` und `calcArrivalTime()` waren in `combat.service.js` und `espionage.service.js` exakt dupliziert.

**Erledigt:** `backend/utils/game-math.js` erstellt. Beide Services importieren die Funktionen daraus. Doppelter Code entfernt.

---

### ✅ P6 – `CODEOWNERS`-Datei anlegen

Keine automatische Reviewer-Zuweisung vorhanden.

**Erledigt:** `.github/CODEOWNERS` mit `* @Hellboy20151011` angelegt.

---

### ✅ P7 – Playwright-Browser-Installation im CI sicherstellen

Der CI-E2E-Job fehlte der Installations-Step für Playwright-Browser.

**Erledigt:** Step `npx playwright install --with-deps chromium` im E2E-Job in `.github/workflows/ci.yml` ergänzt.

---

### ✅ P8 – `permissions: contents: read` in `ci.yml` setzen

`ci.yml` hatte keine explizite `permissions`-Deklaration.

**Erledigt:** `permissions: contents: read` auf Workflow-Ebene in `.github/workflows/ci.yml` gesetzt.

---

### ✅ P9 – `docker-compose.yml` – Postgres-Passwort externalisieren

`POSTGRES_PASSWORD: postgres` war hardcoded.

**Erledigt:** Auf `${POSTGRES_PASSWORD:-postgres}` umgestellt. Variable in `backend/.env.example` dokumentiert.

---

### ✅ P10 – BOM-Zeichen und nicht-technische Docs-Dateien bereinigen

**Erledigt:** BOM-Bytes in `gameloop-scheduler.js` und `CHANGELOG.md` geprüft – beide Dateien waren bereits BOM-frei. Die nicht-technischen Dateien (`docs/hallo.html`, `docs/BEWERTUNG.md` etc.) verbleiben vorerst.

---

## Weitere Refactor-Vorschläge

- **`gameloop.js` aufräumen:** `initializeNewPlayer()` nach `auth.service.js` integrieren und `gameloop.js` entfernen oder umbenennen, um die Redundanz mit `gameloop-scheduler.js` aufzulösen.
- **Coverage-Ausschluss für `buildings.service.js` überdenken:** Mit 429 Zeilen Kernlogik für Gebäudevoraussetzungen, Verhältnis-Checks und Queue-Management sollte dieser Service Coverage haben.
- **Ressourcen-Cap einführen:** Ein `max_amount`-Feld in `building_types` (als Lager-Kapazität) würde unbegrenztes Ressourcen-Akkumulieren verhindern.
- **Frontend-Tests:** Für `karte.js` (600 Zeilen Canvas-Logik) und `dashboard.js` (375 Zeilen) wären zumindest Vitest-Browser-Tests sinnvoll.
