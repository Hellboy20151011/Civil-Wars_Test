# Next Steps – Civil Wars Test

> **Stand:** 2026-05-03 | **Aktualisiert:** 2026-05-03 | **Branch:** `main`  
> Prioritäten: **P0** = sofort, **P1** = diese Woche, **P2** = nächster Sprint  
> Aufwand: **S** = < 1 h · **M** = 1–4 h · **L** = 4–16 h · **XL** = > 16 h  
> **Legende:** ✅ = erledigt · ⏳ = ausstehend

---

## Kurzfristig (diese Woche)

### ✅ P0 – Naming-Konsistenz finalisieren (Aufwand: M | Risiko: 🔴 hoch)

**Erledigt:** `VARIABLES.md` auf `steel_cost`/`steel_production` korrigiert.

- [x] Alle Datei-Referenzen auf die gleiche Sprache vereinheitlichen (DB → API → Doku).
- [x] `VARIABLES.md` und `API_DOCUMENTATION.md` auf Abweichungen prüfen und korrigieren.
- [x] Betroffene Dateien: `backend/database/schemas/`, `backend/repositories/`, `API_DOCUMENTATION.md`, `VARIABLES.md`.

---

### ✅ P0 – Fehlende LICENSE-Datei hinzufügen (Aufwand: S | Risiko: 🟡 mittel)

**Erledigt:** MIT-Lizenz in `LICENSE` angelegt, `README.md` um einen License-Abschnitt ergänzt.

- [x] Lizenz wählen (MIT).
- [x] `LICENSE`-Datei im Root anlegen.
- [x] `README.md` um einen kurzen License-Abschnitt ergänzen.

---

### ✅ P0 – CORS absichern (Aufwand: S | Risiko: 🔴 hoch)

**Erledigt:** `server.js` nutzt `config.cors.origin`, `CORS_ORIGIN` in `.env.example` dokumentiert.

- [x] `CORS_ORIGIN` in `backend/.env.example` als Variable eintragen.
- [x] In `backend/server.js` die `cors()`-Konfiguration auf `process.env.CORS_ORIGIN` setzen.
- [x] Fallback `http://localhost:3000` für die Entwicklungsumgebung sicherstellen.

---

### ✅ P1 – Frontend API-URL konfigurierbar machen (Aufwand: S | Risiko: 🟡 mittel)

**Erledigt:** `frontend/scripts/config.js` erstellt; alle Scripts (`main.js`, `dashboard.js`, `bauhof.js`, `militaer.js`, `shell.js`) importieren `API_BASE_URL` daraus.

- [x] `API_BASE_URL` aus einem zentralen Konfigurationsmodul (`frontend/scripts/config.js`) lesen.
- [x] Alle Frontend-Scripts (`dashboard.js`, `militaer.js`, …) auf das Modul umstellen.

---

### P1 – Testabdeckung für kritische Services ausbauen (Aufwand: M | Risiko: 🔴 hoch)

`backend/tests/services/` ist vorhanden, aber Tick-Logik in
`backend/services/economy.service.js` und `backend/services/units.service.js`
ist bisher kaum durch Unit-Tests abgesichert.

**Aufgaben:**
- [ ] Unit-Tests für `economy.service.js` (Ressourcenproduktion pro Tick).
- [ ] Unit-Tests für `units.service.js` (Einheitenankünfte, Ankunftszeit-Berechnung).
- [ ] Mocks für `pg`-Pool einrichten, damit Tests ohne echte DB laufen.
- [ ] Coverage-Report in CI aktivieren (`vitest --coverage`).

---

### ✅ P1 – PR-Template anlegen (Aufwand: S | Risiko: 🟢 niedrig)

**Erledigt:** `.github/pull_request_template.md` angelegt.

- [x] `.github/pull_request_template.md` anlegen (Beschreibung, Checkliste, Test-Hinweise).

---

## Mittelfristig (nächster Sprint / nächste 2–4 Wochen)

### ✅ P1 – Docker Compose für lokale Entwicklung (Aufwand: M | Impact: 🟢 hoch)

**Erledigt:** `docker-compose.yml` (Root), `backend/Dockerfile`, `backend/.dockerignore` angelegt.
`README.md` enthält einen "Quick Start mit Docker"-Abschnitt.

- [x] `docker-compose.yml` im Root anlegen (Services: `postgres`, `backend`).
- [x] `backend/Dockerfile` erstellen.
- [x] `README.md` um einen „Quick Start mit Docker“ Abschnitt ergänzen.

---

### ✅ P1 – Einheitliche Fehlerresponses (Aufwand: M | Impact: 🟡 mittel)

**Erledigt:** `errorHandler.js` gibt jetzt `{ message, error: { message, code, details } }` zurück.

- [x] Standard-Fehlerformat definieren: `{ error: { message, code, details? } }`.
- [x] `backend/middleware/errorHandler.js` auf dieses Format erweitern.
- [ ] Alle Route-Handler auf konsistentes Format prüfen (direkte `res.json`-Returns in Routen noch vorhanden).

---

### ✅ P1 – Repository-Pattern in Services durchziehen (Aufwand: M | Impact: 🟢 hoch)

**Erledigt:** Services greifen nicht mehr direkt auf `backend/database/db.js` zu.
SQL liegt jetzt in Repositories; Transaktionen laufen über
`backend/repositories/transaction.repository.js`.

- [x] Direkte Pool-Imports aus Services entfernen.
- [x] Fehlende Repository-Methoden für Gebäude-/Einheiten-/Spieler-Abfragen ergänzen.
- [x] Services `buildings.service.js`, `units.service.js`, `gameloop.js`, `gameloop-scheduler.js` auf Repository-Aufrufe umstellen.

---

### ✅ P1 – Datenbankabfragen optimieren (Aufwand: M | Impact: 🟢 hoch)

**Erledigt:** N+1-nahe Insert-Schleifen in Repositories durch Batch-Queries ersetzt,
Stammdaten (`building_types`, `unit_types`, `resource_types`) mit TTL gecacht.

- [x] Batch-Inserts für Gebäude/Queue statt Einzel-Queries.
- [x] In-Memory-Cache für Referenztabellen eingeführt.
- [x] Pool-Größe bleibt via `POOL_MAX` konfigurierbar.

---

### P1 – Logging einführen (Aufwand: M | Impact: 🟡 mittel)

Es gibt kein strukturiertes Request-/Error-Logging (nur `console.log`).

**Aufgaben:**
- [ ] Logger-Bibliothek wählen (z. B. `pino` oder `winston`).
- [ ] Request-Logging-Middleware hinzufügen (dev: verbose, prod: JSON).
- [ ] `console.log`/`console.error` in Services und Routes ersetzen.

---

### P2 – OpenAPI / Swagger Spec (Aufwand: L | Impact: 🟢 hoch)

`API_DOCUMENTATION.md` ist gut gepflegt; eine maschinenlesbare OpenAPI-Spec
würde Client-Generierung und Testautomatisierung ermöglichen.

**Aufgaben:**
- [ ] `docs/openapi.yaml` aus `API_DOCUMENTATION.md` ableiten.
- [ ] Swagger UI als optionale Dev-Route einbinden (`/api-docs`).
- [ ] Request/Response-Schemas mit Zod-Definitionen abgleichen.

---

### ✅ P2 – Frontend-Architektur modernisieren (Aufwand: L | Impact: 🟢 hoch)

**Erledigt:** Komponentenbasis für deklaratives UI-Rendering eingeführt
(`frontend/scripts/ui/component.js`) und alle zentralen Frontend-Views
(`main.js`, `dashboard.js`, `bauhof.js`, `militaer.js`, `shell.js`) migriert.

- [x] `bauhof.js` auf Komponentenmodule umgestellt.
- [x] `militaer.js` auf Komponentenmodule umgestellt.
- [x] Gemeinsames Komponenten-Fundament für weitere Frontend-Features etabliert.

---

### ✅ P2 – Frontend-Bundle mit Vite (Aufwand: M | Impact: 🟢 hoch)

**Erledigt:** Vite als Multi-Page-Bundler eingerichtet. Production-Build erzeugt
minifizierte, gehashte Assets in `frontend/dist`; Backend liefert `dist` automatisch aus,
wenn vorhanden.

- [x] Vite-Konfiguration für `index`, `dashboard`, `bauhof`, `militaer` ergänzt.
- [x] Build-/Preview-Skripte im Frontend eingerichtet.
- [x] Backend-Static-Serving auf `frontend/dist`-Fallback erweitert.

---

### ✅ P1 – Frontend-Lint in CI (Aufwand: S | Impact: 🟢 hoch)

**Erledigt:** ESLint für `frontend/` eingerichtet und als separater CI-Job
(`frontend-lint`) in `.github/workflows/ci.yml` ergänzt.

- [x] Frontend-ESLint-Konfiguration erstellt.
- [x] `npm run lint` im Frontend ergänzt.
- [x] CI-Job für Frontend-Lint aktiviert.

---

### ✅ P1 – Frontend Hot Reload im Dev-Workflow (Aufwand: S | Impact: 🟢 hoch)

**Erledigt:** `backend/package.json` enthält `npm run dev:full`, das Backend
und Vite-Dev-Server parallel startet. Vite läuft auf `http://localhost:5173`
mit automatischem Öffnen von `pages/index.html`.

- [x] Kombinierten Dev-Start für Backend + Frontend ergänzt.
- [x] Vite-Dev-Server-Port/Startseite fest konfiguriert.
- [x] CORS für Backend- und Vite-Origin dokumentiert.

---

### ✅ P2 – Echtzeit-Updates via SSE/WebSocket (Aufwand: M | Impact: 🟢 hoch)

**Erledigt:** `GET /me/stream` (SSE) ergänzt. Tick-Updates werden serverseitig
gepusht und im Frontend ohne Polling aktualisiert.

- [x] Backend-SSE-Stream für authentifizierte Nutzer implementiert.
- [x] Tick-Scheduler sendet Status-Events pro User.
- [x] Frontend-Subscription via `EventSource` eingebunden.

---

### ✅ P2 – CONTRIBUTING.md erstellen (Aufwand: S | Impact: 🟢 hoch)

**Erledigt:** `CONTRIBUTING.md` im Root angelegt, in `README.md` verlinkt.

- [x] `CONTRIBUTING.md` im Root anlegen (Branch-Konvention, Commit-Style, PR-Prozess, Linting).
- [x] In `README.md` verlinken.

---

### P2 – Refresh-Token-Mechanismus (Aufwand: L | Risiko: 🔴 hoch)

Aktuell wird nur ein kurzlebiges JWT ohne Refresh-Token verwendet.

**Aufgaben:**
- [ ] Refresh-Token-Tabelle in der Datenbank (Schema in `backend/database/schemas/`).
- [ ] Neuen Endpunkt `POST /auth/refresh` implementieren.
- [ ] Dokumentation in `API_DOCUMENTATION.md` aktualisieren.

---

## Langfristig (> 1 Monat)

### P2 – Kampfsystem implementieren (Aufwand: XL | Impact: 🟢 sehr hoch)

Das Spiel hat Einheiten, aber kein Kampfsystem. Laut `docs/Issues.md` und
`docs/Units.md` ist das ein geplantes Kernfeature.

**Aufgaben:**
- [ ] Kampf-Mechanik definieren (Rundenbasiert / Echtzeit-Simulation pro Tick).
- [ ] `backend/services/combat.service.js` implementieren.
- [ ] Zugehörige Route, Repository und Schema anlegen.
- [ ] Frontend-Darstellung für Angriffs-/Verteidigungsresultate.

---

### P2 – Karten- / Territorien-System (Aufwand: XL | Impact: 🟢 sehr hoch)

Für ein vollständiges Strategiespiel fehlt eine Karte mit Territorien.

**Aufgaben:**
- [ ] Datenbankschema für Karte/Territorien entwerfen.
- [ ] Backend-Service und Routen für Kartenbewegungen.
- [ ] Frontend-Karten-Rendering (z. B. Canvas oder SVG).

---

### ✅ P2 – Release-Prozess / Semantic Versioning (Aufwand: M | Impact: 🟡 mittel)

**Erledigt:** `CHANGELOG.md` angelegt, `.github/workflows/release.yml` erstellt.

- [x] Changelogformat festlegen (`CHANGELOG.md` nach „Keep a Changelog“).
- [x] GitHub-Releases-Workflow in `.github/workflows/` anlegen (Tag → Release).
- [ ] Semantic Versioning (`major.minor.patch`) im Team kommunizieren.

---

### ✅ P2 – Multi-Player-Session-Sicherheit – Rate-Limiter (Aufwand: S | Risiko: 🔴 hoch)

**Teilweise erledigt:** Rate-Limiter-Konfiguration in `.env` ausgelagert.

- [x] Rate-Limiter-Konfiguration in `.env` auslagern.
- [ ] DB-Transaktionen für alle schreibenden Tick-Operationen sicherstellen.
- [ ] Account-Lockout nach mehreren fehlgeschlagenen Login-Versuchen.

---

## Zusammenfassung nach Aufwand

| Priorität | Aufgabe | Aufwand | Risiko/Impact | Status |
|-----------|---------|---------|---------------|--------|
| P0 | Naming-Konsistenz | M | 🔴 Risiko hoch | ✅ |
| P0 | LICENSE | S | 🟡 mittel | ✅ |
| P0 | CORS absichern | S | 🔴 Risiko hoch | ✅ |
| P1 | Frontend API-URL | S | 🟡 mittel | ✅ |
| P1 | PR-Template | S | 🟢 niedrig | ✅ |
| P1 | Docker Compose | M | 🟢 Impact hoch | ✅ |
| P1 | Fehlerresponses | M | 🟡 mittel | ✅ |
| P1 | CONTRIBUTING.md | S | 🟢 Impact hoch | ✅ |
| P1 | Tests Economy/Units | M | 🔴 Risiko hoch | ⏳ |
| P1 | Logging | M | 🟡 mittel | ⏳ |
| P2 | OpenAPI Spec | L | 🟢 Impact hoch | ⏳ |
| P2 | Release-Prozess | M | 🟡 mittel | ✅ |
| P2 | Refresh Token | L | 🔴 Risiko hoch | ⏳ |
| P2 | Kampfsystem | XL | 🟢 Impact sehr hoch | ⏳ |
| P2 | Karten-System | XL | 🟢 Impact sehr hoch | ⏳ |
| P2 | Multi-Player-Security | L | 🔴 Risiko hoch | ⏳ (Rate-Limit ✅) |
