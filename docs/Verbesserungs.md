# Verbesserungsvorschläge – Civil Wars Test

> **Stand:** 2026-05-03 | **Zielgruppe:** Entwickler-Review  
> Dieses Dokument sammelt Verbesserungsvorschläge für Code-Qualität, Architektur,
> Performance, Developer Experience (DX), Tests, CI/CD, Security, Dokumentation,
> Issue-/PR-Templates und Release-/Versioning-Prozesse.

---

## 1. Code-Qualität

### 1.1 Konsistente Namensgebung (DE/EN)

Das Ressourcen-System verwendet deutsche DB-Spalten (`geld`, `stein`, `stahl`,
`treibstoff`, `strom`), während ältere Dokumente noch englische Bezeichner
(`iron`, `steel`) enthalten. Dies führt zu Verwirrung beim Lesen von Code,
SQL-Abfragen und API-Responses gleichzeitig.

**Empfehlung:** Eine Sprache für alle Bezeichner festlegen (Vorschlag: **Englisch**
für Code/DB/API, Deutsch nur für UI und Benutzeranzeigen). Betroffene Dateien:

- `backend/database/schemas/` (SQL-Schemas)
- `backend/repositories/` (SQL-Abfragen)
- `API_DOCUMENTATION.md`
- `VARIABLES.md`

---

### 1.2 Magic Numbers und Hardcoded-Werte auslagern

In mehreren Dateien finden sich eingebettete Werte (z. B. Port `3000` in
`frontend/scripts/main.js`, Tick-Intervalle in
`backend/services/gameloop-scheduler.js`). Diese sollten in Konfigurationsobjekten
oder Umgebungsvariablen zentralisiert werden.

**Empfehlung:**
- Alle konfigurierbaren Werte in `backend/.env.example` dokumentieren.
- Zentrale Konstanten-Datei `backend/config.js` (oder `backend/constants.js`)
  für nicht-sensitive Defaults anlegen.

---

### 1.3 Fehlerbehandlung vereinheitlichen

Einige Routen geben bei Fehlern direkt `res.status(400).json({ error: '...' })`
zurück, andere delegieren an `backend/middleware/errorHandler.js`. Das macht
den API-Contract inkonsistent.

**Empfehlung:** Alle Routen sollen Fehler ausschließlich über den zentralen
`errorHandler` (`next(err)`) melden. Standard-Fehlerformat:
```json
{
  "error": {
    "message": "Beschreibung des Fehlers",
    "code": "RESOURCE_NOT_FOUND",
    "details": {}
  }
}
```

---

### 1.4 Async/Await statt `.then()`-Ketten

Wo noch Promise-Chains verwendet werden, sollte auf `async/await` umgestellt
werden, um Lesbarkeit und Fehlerbehandlung zu verbessern. `backend/middleware/asyncWrapper.js`
ist bereits vorhanden – alle Routen sollten es konsequent nutzen.

---

## 2. Architektur

### 2.1 Konfigurationsschicht

Derzeit werden Umgebungsvariablen direkt überall mit `process.env.XYZ` gelesen.
Ein zentrales Konfigurationsmodul (`backend/config.js`) würde:
- Validierung beim Start ermöglichen (fehlt ein `.env`-Eintrag → sofortiger Fehler).
- Tests einfacher machen (Mock der Konfiguration statt `process.env`-Manipulation).

**Beispiel** (`backend/config.js`):
```js
export const config = {
  port: Number(process.env.PORT) || 3000,
  db: { /* ... */ },
  jwt: { secret: process.env.JWT_SECRET, expiresIn: process.env.JWT_EXPIRES_IN },
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
};
```

---

### 2.2 Repository-Pattern konsequent anwenden

`backend/repositories/` enthält DB-Abfragen, aber einige Services importieren
den Pool (`backend/database/db.js`) direkt. Dies sollte vollständig in die
Repository-Schicht verlagert werden, damit Services datenbankagnostisch bleiben.

---

### 2.3 Frontend-Architektur modernisieren (mittelfristig)

Das Frontend besteht aus reinem Vanilla-JS mit DOM-Manipulation.
Für wachsende Komplexität (Kampf, Karte, Echtzeit-Updates) wird das schwer
wartbar.

**Optionen (aufsteigend nach Aufwand):**
1. Einfaches Komponentensystem selbst bauen (Mini-Framework).
2. Leichtgewichtiger Reaktivitätslayer wie **Preact** oder **Solid.js**.
3. Vollständiges Framework wie **Vue 3** oder **React** (mit Vite Build).

---

### 2.4 WebSocket für Echtzeit-Updates

Aktuell pollt das Frontend Ressourcen/Einheiten-Daten. Mit WebSockets oder
Server-Sent Events (SSE) könnten Tick-Updates sofort an alle verbundenen
Clients gepusht werden – ohne Polling-Overhead.

---

## 3. Performance

### 3.1 Datenbankabfragen optimieren

- N+1-Abfragen in Repositories vermeiden: statt mehrerer einzelner `SELECT`-
  Statements pro Einheit/Gebäude besser JOINs oder Batch-Abfragen nutzen.
- DB-Verbindungspool-Größe (`backend/database/db.js`) konfigurierbar machen
  (via `POOL_MAX` in `.env`).
- Häufig gelesene Stammdaten (z. B. `building_types`, `resource_types`) im
  Application-Memory cachen (einfaches In-Memory-Cache für wenige Minuten TTL).

---

### 3.2 Frontend-Bundle-Größe

Das Frontend lädt aktuell kein Build-Tool (reines ESM). Für Produktion empfiehlt
sich ein Bundler (z. B. **Vite**), der:
- Dateien minifiziert und komprimiert.
- Tree-Shaking für ungenutzte Module durchführt.
- Lange Cache-Hashes für Assets erzeugt.

---

## 4. Developer Experience (DX)

### 4.1 Docker Compose für lokales Setup

Aktuell muss PostgreSQL manuell installiert werden. Ein `docker-compose.yml`
im Root (Services: `postgres` + `backend`) würde den Onboarding-Aufwand von
~30 min auf ~2 min reduzieren.

```yaml
# docker-compose.yml (Beispiel)
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_DB: civil_wars_test
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports: ["5432:5432"]
  backend:
    build: ./backend
    env_file: ./backend/.env
    depends_on: [db]
    ports: ["3000:3000"]
```

---

### 4.2 Hot Reload Frontend

Das Backend nutzt `node --watch` (`npm run dev` in `backend/package.json`),
aber Frontend-Änderungen erfordern manuelles Neuladen des Browsers. Ein
einfacher Dev-Server mit Live-Reload (z. B. `browser-sync` oder Vite Dev-Server)
würde die Entwicklungsgeschwindigkeit erhöhen.

---

### 4.3 EditorConfig hinzufügen

Neben `.prettierrc` in `backend/` fehlt eine `.editorconfig` im Root, die
Basis-Formatierungsregeln (Einrückung, Zeilenenden) für alle Editoren setzt –
auch für Entwickler, die Prettier nicht installiert haben.

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
| Frontend-Lint | ESLint/Prettier-Check für `frontend/scripts/` |
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

### 7.1 CORS-Konfiguration

`backend/server.js` öffnet CORS für alle Origins (`cors()` ohne Konfiguration).
In Produktion muss der erlaubte Origin eingeschränkt werden.

**Empfehlung:**
```js
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:3000' }));
```
`CORS_ORIGIN` in `backend/.env.example` dokumentieren.

---

### 7.2 JWT-Secret-Stärke

`backend/.env.example` enthält den Hinweis `change_this_to_a_long_random_secret_before_production`.
In CI/CD muss sichergestellt werden, dass nie der Default-Wert in Produktion landet.

**Empfehlung:**
- Startup-Validierung: Wenn `JWT_SECRET` kürzer als 32 Zeichen ist, Server-Start
  mit Fehler abbrechen.
- Secrets nur als CI/CD-Secrets oder Secret-Manager (z. B. GitHub Secrets) verwalten.

---

### 7.3 Rate-Limiter-Konfiguration

`backend/middleware/rateLimiters.js` enthält vermutlich Hardcode-Werte für
Fenster und maximale Anfragen. Diese sollten per `.env` konfigurierbar sein,
damit Prod/Dev unterschiedliche Limits haben können.

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

| Dokument | Warum wichtig |
|----------|---------------|
| `CONTRIBUTING.md` | Onboarding externer Beitragender |
| `CHANGELOG.md` | Nachvollziehbarkeit von Änderungen |
| `LICENSE` | Rechtliche Klarheit |
| `docs/openapi.yaml` | Maschinenlesbare API-Spec |
| `docs/architecture.md` | Architektur-Entscheidungen (ADRs) |

---

### 8.3 JSDoc / Code-Kommentare

Kritische Funktionen (Tick-Logik, Kampf-Berechnung, Token-Generierung) sollten
JSDoc-Kommentare haben, die Parameter, Rückgabewerte und Seiteneffekte beschreiben.

---

## 9. Issue- und PR-Templates

### 9.1 Aktueller Status

`.github/ISSUE_TEMPLATE/neues-gebaeude.yml` existiert – das ist ein guter Anfang.
Ein PR-Template fehlt noch.

---

### 9.2 Empfohlene Templates

**Pull-Request-Template** (`.github/pull_request_template.md`):
```markdown
## Beschreibung
<!-- Was wurde geändert und warum? -->

## Art der Änderung
- [ ] Bug Fix
- [ ] Neues Feature
- [ ] Refactoring
- [ ] Dokumentation

## Checkliste
- [ ] Lint-Check bestanden (`npm run lint`)
- [ ] Tests hinzugefügt / aktualisiert
- [ ] Dokumentation aktualisiert
- [ ] Breaking Changes dokumentiert
```

**Weitere Issue-Templates:**
- `bug_report.yml` – strukturierte Fehlerberichte.
- `feature_request.yml` – Feature-Anfragen.

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

### 10.2 CHANGELOG

`CHANGELOG.md` nach dem Format [Keep a Changelog](https://keepachangelog.com/)
pflegen. Sections: `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`.

---

### 10.3 GitHub Release Workflow

Automatischen Release-Workflow in `.github/workflows/release.yml` anlegen:
1. Auf Git-Tag-Push (`v*.*.*`) triggern.
2. Tests laufen lassen.
3. GitHub-Release mit generiertem Changelog erstellen.

---

## Zusammenfassung – Prioritäten

| Kategorie | Wichtigste Maßnahme | Aufwand |
|-----------|---------------------|---------|
| Code-Qualität | Naming-Konsistenz DE/EN | M |
| Architektur | Zentrale Konfigurationsschicht | M |
| Performance | N+1-Abfragen in Repositories | M |
| DX | Docker Compose | M |
| Tests | Unit-Tests Economy/Units-Service | M |
| CI/CD | Security Audit + Dependabot | S |
| Security | CORS einschränken + JWT-Validierung | S |
| Dokumentation | CONTRIBUTING.md + LICENSE | S |
| Templates | PR-Template + Bug-Report-Template | S |
| Versioning | CHANGELOG.md + Release-Workflow | M |
