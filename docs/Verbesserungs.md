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

### 5.1 Testabdeckung für Business-Logik

Die kritischsten Module (`economy.service.js`, `units.service.js`,
`gameloop-scheduler.js`) sind schwer zu regressionssichern ohne Tests.

**Empfehlung:**
- Unit-Tests mit **Vitest** (bereits in `devDependencies` vorhanden) für alle
  Services in `backend/tests/services/`.
- Mocking von `backend/database/db.js`-Pool, damit Tests ohne laufende DB laufen.
- Integration-Tests für kritische API-Endpunkte (Auth-Flow, Gebäude-Bau) mit
  einer Test-DB in CI.

---

### 5.2 Code Coverage Reporting

Vitest unterstützt `--coverage` (mit `@vitest/coverage-v8`). Ein Coverage-Report
in CI hilft, ungetestate Pfade sichtbar zu machen.

**Empfehlung:**
```bash
npx vitest run --coverage
```
Coverage-Schwelle in `backend/package.json` via Vitest-Config definieren.

---

### 5.3 End-to-End-Tests (langfristig)

Für das gesamte Spiel-Flow (Register → Login → Gebäude bauen → Tick abwarten)
wären E2E-Tests mit **Playwright** oder **Cypress** wertvoll.

---

## 6. CI/CD

### 6.1 Aktueller Status

`.github/workflows/ci.yml` führt bei Push/PR auf `main` aus:
- `npm ci`
- `npm run lint`
- `npm test`

Das ist eine solide Basis.

---

### 6.2 Fehlende CI-Schritte

| Fehlend | Empfehlung |
|---------|-----------|
| Code Coverage | `vitest --coverage` + Upload zu Codecov o. Ä. |
| Frontend-Lint | ✅ ESLint-Check für `frontend/` in CI ergänzt |
| Security Audit | `npm audit --audit-level=high` als CI-Schritt |
| Dependency Updates | Dependabot in `.github/dependabot.yml` aktivieren |
| Release-Workflow | Tag-basierter Workflow für GitHub-Releases |

---

### 6.3 Branch-Schutz-Regeln

Für `main` sollten folgende Branch-Protection-Regeln aktiviert werden:
- Status-Checks müssen bestehen (CI muss grün sein).
- Mindestens 1 Review vor Merge.
- Force-Push deaktivieren.

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

### 7.4 SQL-Injection

Alle Datenbankabfragen sollten ausschließlich parametrierte Queries verwenden
(kein String-Concatenation für SQL). Das `pg`-Modul unterstützt parametrierte
Queries nativ – bitte in Code-Reviews darauf achten.

---

### 7.5 Abhängigkeits-Audits

Regelmäßige `npm audit` Checks:
- Manuell: `npm audit --audit-level=high`
- Automatisiert: Dependabot in `.github/dependabot.yml` aktivieren.

---

## 8. Dokumentation

### 8.1 Vorhandene Dokumentation (Stärken)

Das Projekt hat bereits eine überdurchschnittlich gute Dokumentation für einen
Prototyp:
- `README.md` mit Setup, Start-Kommandos, Struktur, Ressourcen-Tabelle.
- `API_DOCUMENTATION.md` mit Endpunkten, Beispiel-Requests, Statuscodes.
- `VARIABLES.md` mit Modul-Exports und DB-Schema.
- `docs/BEWERTUNG.md`, `docs/Buildings.md`, `docs/Issues.md`, `docs/Resources.md`,
  `docs/Units.md` als interne Design-Dokumente.

---

### 8.2 Fehlende Dokumentation

| Dokument | Warum wichtig | Status |
|----------|---------------|--------|
| `CONTRIBUTING.md` | Onboarding externer Beitragender | ✅ angelegt |
| `CHANGELOG.md` | Nachvollziehbarkeit von Änderungen | ✅ angelegt |
| `LICENSE` | Rechtliche Klarheit | ✅ angelegt (MIT) |
| `docs/openapi.yaml` | Maschinenlesbare API-Spec | ⏳ ausstehend |
| `docs/architecture.md` | Architektur-Entscheidungen (ADRs) | ⏳ ausstehend |

---

### 8.3 JSDoc / Code-Kommentare

Kritische Funktionen (Tick-Logik, Kampf-Berechnung, Token-Generierung) sollten
JSDoc-Kommentare haben, die Parameter, Rückgabewerte und Seiteneffekte beschreiben.

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

### 10.1 Semantic Versioning

`backend/package.json` steht auf `"version": "1.0.0"`. Bisher gibt es keine
Versionierungsregeln im Team.

**Empfehlung:**
- **MAJOR**: Breaking API Changes.
- **MINOR**: Neue Features (rückwärtskompatibel).
- **PATCH**: Bug Fixes, Dokumentation.

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
| Tests | Unit-Tests Economy/Units-Service | M | ⏳ |
| CI/CD | Security Audit + Dependabot | S | ✅ |
| Security | CORS einschränken + JWT-Validierung | S | ✅ |
| Dokumentation | CONTRIBUTING.md + LICENSE | S | ✅ |
| Templates | PR-Template + Bug-Report-Template | S | ✅ |
| Versioning | CHANGELOG.md + Release-Workflow | M | ✅ |
