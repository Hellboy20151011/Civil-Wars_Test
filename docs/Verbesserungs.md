# Verbesserungsvorschläge – Civil Wars Test

> **Stand:** 2026-05-03 | **Aktualisiert:** 2026-05-03 | **Zielgruppe:** Entwickler-Review  
> Dieses Dokument sammelt Verbesserungsvorschläge für Code-Qualität, Architektur,
> Performance, Developer Experience (DX), Tests, CI/CD, Security, Dokumentation,
> Issue-/PR-Templates und Release-/Versioning-Prozesse.
>
> **Legende:** ✅ = umgesetzt · 🔄 = in Arbeit · ⏳ = ausstehend

---

## 1. Code-Qualität

### ✅ 1.1 Konsistente Namensgebung (DE/EN)

~~Das Ressourcen-System verwendet deutsche DB-Spalten (`geld`, `stein`, `stahl`,
`treibstoff`, `strom`), während ältere Dokumente noch englische Bezeichner
(`iron`, `steel`) enthalten.~~

**Umgesetzt:** `VARIABLES.md` auf `steel_cost`/`steel_production` korrigiert.

---

### ✅ 1.2 Magic Numbers und Hardcoded-Werte auslagern

~~In mehreren Dateien finden sich eingebettete Werte (z. B. Port `3000` in
`frontend/scripts/main.js`, Tick-Intervalle in
`backend/services/gameloop-scheduler.js`).~~

**Umgesetzt:** `backend/config.js` zentralisiert alle konfigurierbaren Werte.
`backend/.env.example` dokumentiert alle Variablen inkl. Rate-Limit und Gameloop.
Frontend-Scripts lesen `API_BASE_URL` aus `frontend/scripts/config.js`.

---

### ✅ 1.3 Fehlerbehandlung vereinheitlichen

**Umgesetzt:** `errorHandler.js` gibt jetzt `{ message, error: { message, code, details } }` zurück.
Direct-Returns in Routen verwenden bereits einheitlich `{ message }`.
Das `error`-Objekt ermöglicht maschinenlesbare Fehlercodes für zukünftige Clients.

---

### ✅ 1.4 Async/Await statt `.then()`-Ketten

~~Wo noch Promise-Chains verwendet werden, sollte auf `async/await` umgestellt
werden, um Lesbarkeit und Fehlerbehandlung zu verbessern. `backend/middleware/asyncWrapper.js`
ist bereits vorhanden – alle Routen sollten es konsequent nutzen.~~

**Umgesetzt:** Alle Routen nutzen `asyncWrapper` konsistent. Verbleibende
`.catch(...)`-Ketten in `backend/services/gameloop-scheduler.js` wurden durch
`async/await` mit `try/catch` ersetzt.

---

## 2. Architektur

### ✅ 2.1 Konfigurationsschicht

**Umgesetzt:** `backend/config.js` validiert beim Start JWT-Secret-Länge (min. 32 Zeichen),
zentralisiert alle `process.env`-Zugriffe und wird von `server.js`, `auth.js`,
`rateLimiters.js`, `db.js` und `gameloop-scheduler.js` genutzt.

---

### ✅ 2.2 Repository-Pattern konsequent anwenden

~~`backend/repositories/` enthält DB-Abfragen, aber einige Services importieren
den Pool (`backend/database/db.js`) direkt. Dies sollte vollständig in die
Repository-Schicht verlagert werden, damit Services datenbankagnostisch bleiben.~~

**Umgesetzt:** Services importieren den Pool nicht mehr direkt. DB-Zugriffe
liegen in Repositories (u. a. `building.repository.js`, `units.repository.js`,
`player.repository.js`) und Transaktionen laufen zentral über
`transaction.repository.js`.

---

### ✅ 2.3 Frontend-Architektur modernisieren (mittelfristig)

Das Frontend besteht aus reinem Vanilla-JS mit DOM-Manipulation.
Für wachsende Komplexität (Kampf, Karte, Echtzeit-Updates) wird das schwer
wartbar.

**Optionen (aufsteigend nach Aufwand):**
1. Einfaches Komponentensystem selbst bauen (Mini-Framework).
2. Leichtgewichtiger Reaktivitätslayer wie **Preact** oder **Solid.js**.
3. Vollständiges Framework wie **Vue 3** oder **React** (mit Vite Build).

**Umgesetzt:** Komponentenbasis (`frontend/scripts/ui/component.js`) eingeführt
und alle zentralen Frontend-Views (`main.js`, `dashboard.js`, `bauhof.js`,
`militaer.js`, `shell.js`) auf deklarative UI-Bausteine migriert.

---

### ✅ 2.4 WebSocket für Echtzeit-Updates

~~Aktuell pollt das Frontend Ressourcen/Einheiten-Daten. Mit WebSockets oder
Server-Sent Events (SSE) könnten Tick-Updates sofort an alle verbundenen
Clients gepusht werden – ohne Polling-Overhead.~~

**Umgesetzt:** SSE-Stream unter `GET /me/stream` implementiert. Der Gameloop
pusht pro Tick den aktualisierten Spielerstatus; das Frontend (`shell.js`) abonniert
den Stream via `EventSource` und aktualisiert Ressourcen/Produktion live.

---

## 3. Performance

### ✅ 3.1 Datenbankabfragen optimieren

~~- N+1-Abfragen in Repositories vermeiden: statt mehrerer einzelner `SELECT`-
  Statements pro Einheit/Gebäude besser JOINs oder Batch-Abfragen nutzen.
- DB-Verbindungspool-Größe (`backend/database/db.js`) konfigurierbar machen
  (via `POOL_MAX` in `.env`).
- Häufig gelesene Stammdaten (z. B. `building_types`, `resource_types`) im
  Application-Memory cachen (einfaches In-Memory-Cache für wenige Minuten TTL).~~

**Umgesetzt:**
- Batch-Inserts für Gebäude/Queue statt Query-Schleifen (`building.repository.js`).
- Stammdaten-Cache mit TTL für `building_types`, `unit_types`, `resource_types`
  (`reference-data.repository.js`, TTL via `REFERENCE_DATA_CACHE_TTL_MS`).
- Resource-Type-Lookups optimiert und Startressourcen als Batch-Upsert umgesetzt
  (`resources.repository.js`).
- Pool-Größe war bereits über `POOL_MAX` konfigurierbar und dokumentiert.

---

### ✅ 3.2 Frontend-Bundle-Größe

~~Das Frontend lädt aktuell kein Build-Tool (reines ESM). Für Produktion empfiehlt
sich ein Bundler (z. B. **Vite**), der:
- Dateien minifiziert und komprimiert.
- Tree-Shaking für ungenutzte Module durchführt.
- Lange Cache-Hashes für Assets erzeugt.~~

**Umgesetzt:** Vite als Multi-Page-Bundler eingerichtet (`frontend/vite.config.js`,
`frontend/package.json`). Production-Build erzeugt minifizierte, gehashte Assets
in `frontend/dist`; Backend liefert automatisch `frontend/dist` aus, falls vorhanden.

---

## 4. Developer Experience (DX)

### ✅ 4.1 Docker Compose für lokales Setup

**Umgesetzt:** `docker-compose.yml` (Root) mit Services `db` (postgres:16) und `backend`.
`backend/Dockerfile` und `backend/.dockerignore` angelegt.
`README.md` enthält einen "Quick Start mit Docker"-Abschnitt.

---

### ✅ 4.2 Hot Reload Frontend

**Umgesetzt:** `backend/package.json` enthält jetzt `npm run dev:full`, das
Backend-Watch (`node --watch`) und den Vite-Dev-Server parallel startet.
`frontend/vite.config.js` setzt den Dev-Server auf Port `5173` und öffnet
automatisch `pages/index.html`. `backend/config.js` und `.env.example`
unterstützen mehrere CORS-Origins (inkl. `http://localhost:5173`).

---

### ✅ 4.3 EditorConfig hinzufügen

**Umgesetzt:** `.editorconfig` im Root angelegt.

---

## 5. Tests

### ✅ 5.1 Testabdeckung für Business-Logik

**Umgesetzt:** Unit-Tests mit Vitest für alle kritischen Services:
- `backend/tests/services/units.service.test.js` – 19 Tests: Getter, `startTraining`, `moveUnits`, `arriveAtDestination`, `attackUnits`
- `backend/tests/services/gameloop-scheduler.test.js` – 7 Tests: `executeGameTick`, `getTickStats`, `startGameLoop`
- Alle Abhängigkeiten (Repositories, DB-Pool, config) werden via `vi.mock()` ersetzt; Tests laufen ohne laufende DB.
- `backend/tests/services/economy.service.test.js` war bereits vorhanden (11 Tests).
- Gesamt: **37 Tests**, alle grün.

---

### ✅ 5.2 Code Coverage Reporting

**Umgesetzt:** `@vitest/coverage-v8` installiert.
- `npm run test:coverage` erzeugt einen Abdeckungsbericht (Text + LCOV) in `backend/coverage/`.
- `backend/vitest.config.js` definiert Schwellen: Statements/Lines/Functions ≥80 %, Branches ≥60 %.
- Aktuell erreicht: Statements 88 %, Branches 89 %, Functions 87 %, Lines 88 %.
- CI-Workflow führt `npm run test:coverage` nach den Unit-Tests aus.

---

### ✅ 5.3 End-to-End-Tests

**Umgesetzt:** Playwright API-E2E-Tests für den kritischen Spiel-Flow:
- `backend/tests/e2e/auth-flow.test.js` – Register, Login, Authentifizierungsschutz, Startressourcen
- `backend/tests/e2e/buildings-flow.test.js` – Gebäudetypen, Rathaus-Startgebäude, Bauwarteschlange, Gebäude bauen, vollständiger Spiel-Flow
- `backend/playwright.config.js` konfiguriert die `baseURL` gegenüber dem laufenden Backend
- `npm run test:e2e` führt die Tests aus; benötigt laufendes Backend + DB
- CI-Job `e2e` in `.github/workflows/ci.yml` mit postgres:16-Service-Container, `node scripts/resetdb.js` und `wait-on` für Health-Check

---

## 6. CI/CD

### ✅ 6.1 Aktueller Status

`.github/workflows/ci.yml` führt bei Push/PR auf `main` aus:
- `npm ci`
- `npm run lint`
- `npm test`
- `npm run test:coverage` (Coverage-Schwellen)
- `npm audit --audit-level=high` (Security Audit)
- E2E-Job mit postgres:16-Service

Das ist eine solide Basis.

---

### ✅ 6.2 Fehlende CI-Schritte

| Fehlend | Status |
|---------|-------|
| Code Coverage | ✅ `vitest --coverage` in CI, Schwellen in `vitest.config.js` |
| Frontend-Lint | ✅ ESLint-Check für `frontend/` in CI ergänzt |
| Security Audit | ✅ `npm audit --audit-level=high` als CI-Schritt ergänzt |
| Dependency Updates | ✅ Dependabot für `/backend`, `/frontend` und `github-actions` aktiv |
| Release-Workflow | ✅ Tag-basierter Workflow in `.github/workflows/release.yml` |

---

### ✅ 6.3 Branch-Schutz-Regeln

Branch-Protection-Regeln können nicht als Datei im Repository hinterlegt werden –
sie müssen einmalig von einem Repository-Admin unter **Settings → Branches** gesetzt werden.

**Dokumentiert in `CONTRIBUTING.md`** (Abschnitt „Branch-Schutz-Regeln“):

| Einstellung | Wert |
|-------------|------|
| Require a pull request before merging | ✔ aktiv |
| Required approvals | 1 |
| Require status checks to pass | ✔ aktiv |
| Required checks | `Lint & Test (Backend)`, `Build (Frontend)`, `Lint (Frontend)` |
| Allow force pushes | ✘ deaktiviert |
| Allow deletions | ✘ deaktiviert |

---

## 7. Security

### ✅ 7.1 CORS-Konfiguration

**Umgesetzt:** `server.js` nutzt `config.cors.origin`, `.env.example` dokumentiert `CORS_ORIGIN`.

---

### ✅ 7.2 JWT-Secret-Stärke

**Umgesetzt:** `backend/config.js` bricht den Server-Start ab, wenn `JWT_SECRET` kürzer als
32 Zeichen ist oder fehlt. `.env.example` enthält einen entsprechenden Hinweis.

---

### ✅ 7.3 Rate-Limiter-Konfiguration

**Umgesetzt:** `rateLimiters.js` liest Werte aus `config.rateLimit.*`.
Alle Werte sind via `RATE_AUTH_WINDOW_MS`, `RATE_AUTH_MAX`, `RATE_API_WINDOW_MS`, `RATE_API_MAX` in `.env` konfigurierbar.

---

### ✅ 7.4 SQL-Injection

**Geprüft:** Alle Datenbankabfragen in `backend/repositories/` verwenden ausschließlich
parametrierte Queries (`$1, $2, ...` mit separatem Parameter-Array). Keine String-Konkatenation
oder Template-Literale mit eingebetteten Variablen gefunden.

**Regel in `.github/copilot-instructions.md` ergänzt:** Copilot wird angewiesen,
nur parametrierte Queries zu generieren.

---

### ✅ 7.5 Abhängigkeits-Audits

**Umgesetzt:**
- `npm audit --audit-level=high` läuft als CI-Schritt nach jedem Push.
- Dependabot überwacht `/backend`, `/frontend` und `github-actions` wöchentlich.

---

## 8. Dokumentation

### ✅ 8.1 Vorhandene Dokumentation (Stärken)

Das Projekt hat eine überdurchschnittlich gute Dokumentation für einen Prototyp.
Aktuelle Root-Dateien:

| Datei | Inhalt |
|-------|--------|
| `README.md` | Setup, Start-Kommandos, Projektstruktur, Docker-Quickstart, Ressourcen-Tabelle |
| `API_DOCUMENTATION.md` | Alle Endpunkte mit Beispiel-Requests und Statuscodes |
| `VARIABLES.md` | Modul-Exports, DB-Schema, Ressourcen-Felder |
| `CONTRIBUTING.md` | Onboarding, Branch-Konvention, Commit-Style, PR-Workflow, Branch-Schutz-Regeln |
| `CHANGELOG.md` | Alle Änderungen nach Keep a Changelog |
| `LICENSE` | MIT-Lizenz |

Interne Design-Dokumente (`docs/`):

| Datei | Inhalt |
|-------|--------|
| `docs/BEWERTUNG.md` | Projektbewertung und Anforderungen |
| `docs/Issues.md` | Bekannte offene Punkte |
| `docs/next-steps.md` | Roadmap nächster Schritte |
| `docs/Verbesserungs.md` | Dieses Dokument |
| `docs/Vorgaben/Buildings.md` | Gebäude-Designvorgaben |
| `docs/Vorgaben/Resources.md` | Ressourcen-Designvorgaben |
| `docs/Vorgaben/Units.md` | Einheiten-Designvorgaben |

GitHub-Prozesse (`.github/`):

| Datei | Inhalt |
|-------|--------|
| `copilot-instructions.md` | Copilot-Konventionen für dieses Projekt |
| `pull_request_template.md` | PR-Checkliste |
| `ISSUE_TEMPLATE/bug_report.yml` | Strukturiertes Bug-Report-Formular |
| `ISSUE_TEMPLATE/feature_request.yml` | Feature-Request-Formular |
| `ISSUE_TEMPLATE/neues-gebaeude.yml` | Gebäude-Request-Formular |
| `workflows/ci.yml` | CI: Lint, Tests, Coverage, Security Audit, E2E |
| `workflows/release.yml` | Release-Workflow für Git-Tags |
| `dependabot.yml` | Automatische Dependency-Updates |

---

### ✅ 8.2 Fehlende Dokumentation

| Dokument | Warum wichtig | Status |
|----------|---------------|--------|
| `CONTRIBUTING.md` | Onboarding externer Beitragender | ✅ angelegt |
| `CHANGELOG.md` | Nachvollziehbarkeit von Änderungen | ✅ angelegt |
| `LICENSE` | Rechtliche Klarheit | ✅ angelegt (MIT) |
| `docs/openapi.yaml` | Maschinenlesbare API-Spec | ✅ angelegt |
| `docs/architecture.md` | Architektur-Entscheidungen (ADRs) | ✅ angelegt |

---

### ✅ 8.3 JSDoc / Code-Kommentare

**Umgesetzt:** Kritische Funktionen wurden mit JSDoc ergänzt (Parameter, Rückgabewerte,
Seiteneffekte):
- `backend/services/economy.service.js` – `applyProductionTicks`, `processFinishedQueue`
- `backend/services/units.service.js` – `attackUnits`
- `backend/services/gameloop-scheduler.js` – `executeGameTick`
- `backend/routes/auth.js` – `requireAuth` und neue Helper-Funktion `signAuthToken`

---

## 9. Issue- und PR-Templates

### ✅ 9.1 Aktueller Status

`.github/ISSUE_TEMPLATE/neues-gebaeude.yml` existiert.

**Zusätzlich umgesetzt:** PR-Template, `bug_report.yml`, `feature_request.yml` angelegt.

---

### ✅ 9.2 Empfohlene Templates

**Umgesetzt:**
- `.github/pull_request_template.md`
- `.github/ISSUE_TEMPLATE/bug_report.yml`
- `.github/ISSUE_TEMPLATE/feature_request.yml`

---

## 10. Release- und Versionierungs-Prozess

### ✅ 10.1 Semantic Versioning

`backend/package.json` steht auf `"version": "1.0.0"`. Bisher gibt es keine
Versionierungsregeln im Team.

**Umgesetzt:** Verbindliche SemVer-Teamregeln in `CONTRIBUTING.md` ergänzt.

- **MAJOR**: Breaking API Changes.
- **MINOR**: Neue Features (rückwärtskompatibel).
- **PATCH**: Bug Fixes, Dokumentation.

Zusätzlich dokumentiert: `BREAKING CHANGE`-Hinweis im PR-Titel, Tag-Schema
`vX.Y.Z` und Pflicht zur Changelog-Pflege unter `[Unreleased]`.

---

### ✅ 10.2 CHANGELOG

**Umgesetzt:** `CHANGELOG.md` im Root nach [Keep a Changelog](https://keepachangelog.com/) angelegt.

---

### ✅ 10.3 GitHub Release Workflow

**Umgesetzt:** `.github/workflows/release.yml` – triggert auf Git-Tag-Push (`v*.*.*`),
führt Tests aus und erstellt einen GitHub-Release.

---

## Zusammenfassung – Prioritäten

| Kategorie | Wichtigste Maßnahme | Aufwand | Status |
|-----------|---------------------|---------|--------|
| Code-Qualität | Naming-Konsistenz DE/EN | M | ✅ |
| Architektur | Repository-Pattern + Frontend-Komponentenbasis | M | ✅ |
| Performance | N+1 + Cache + Frontend-Bundling (Vite) | M | ✅ |
| DX | Docker Compose | M | ✅ |
| Tests | Unit-Tests Economy/Units-Service | M | ✅ |
| CI/CD | Security Audit + Dependabot | S | ✅ |
| Security | CORS einschränken + JWT-Validierung | S | ✅ |
| Dokumentation | CONTRIBUTING.md + LICENSE | S | ✅ |
| Templates | PR-Template + Bug-Report-Template | S | ✅ |
| Versioning | CHANGELOG.md + Release-Workflow | M | ✅ |
