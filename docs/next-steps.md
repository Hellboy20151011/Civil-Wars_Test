# Next Steps – Civil Wars Test

> **Stand:** 2026-05-03 | **Branch:** `main`  
> Prioritäten: **P0** = sofort, **P1** = diese Woche, **P2** = nächster Sprint  
> Aufwand: **S** = < 1 h · **M** = 1–4 h · **L** = 4–16 h · **XL** = > 16 h

---

## Kurzfristig (diese Woche)

### P0 – Naming-Konsistenz finalisieren (Aufwand: M | Risiko: 🔴 hoch)

Das Ressourcen-System verwendet aktuell deutsche Feldnamen in der DB
(`geld`, `stein`, `stahl`, `treibstoff`, `strom`), während ältere Doku-Schnipsel
noch `iron` / `steel` erwähnen.

**Aufgaben:**
- [ ] Alle Datei-Referenzen auf die gleiche Sprache vereinheitlichen (DB → API → Doku).
- [ ] `VARIABLES.md` und `API_DOCUMENTATION.md` auf Abweichungen prüfen und korrigieren.
- [ ] Betroffene Dateien: `backend/database/schemas/`, `backend/repositories/`, `API_DOCUMENTATION.md`, `VARIABLES.md`.

---

### P0 – Fehlende LICENSE-Datei hinzufügen (Aufwand: S | Risiko: 🟡 mittel)

Das Repo enthält keine `LICENSE`-Datei; ohne explizite Lizenz gelten alle Rechte
beim Autor und externe Beiträge sind rechtlich unklar.

**Aufgaben:**
- [ ] Lizenz wählen (z. B. MIT für Open Source, AGPL-3.0 für Copyleft).
- [ ] `LICENSE`-Datei im Root anlegen.
- [ ] `README.md` um einen kurzen License-Abschnitt ergänzen.

---

### P0 – CORS absichern (Aufwand: S | Risiko: 🔴 hoch)

`backend/server.js` öffnet CORS für alle Origins. In Produktion muss der
erlaubte Origin auf die tatsächliche Frontend-URL eingeschränkt werden.

**Aufgaben:**
- [ ] `CORS_ORIGIN` in `backend/.env.example` als Variable eintragen.
- [ ] In `backend/server.js` die `cors()`-Konfiguration auf `process.env.CORS_ORIGIN` setzen.
- [ ] Fallback `http://localhost:3000` für die Entwicklungsumgebung sicherstellen.

---

### P1 – Frontend API-URL konfigurierbar machen (Aufwand: S | Risiko: 🟡 mittel)

`frontend/scripts/main.js` enthält `const API_BASE_URL = 'http://localhost:3000'`
als Hardcode-Wert. Das macht Deployments auf anderen URLs mühsam.

**Aufgaben:**
- [ ] `API_BASE_URL` aus einem zentralen Konfigurationsmodul (`frontend/scripts/config.js`) lesen.
- [ ] Alle Frontend-Scripts (`dashboard.js`, `militaer.js`, …) auf das Modul umstellen.

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

### P1 – PR-Template anlegen (Aufwand: S | Risiko: 🟢 niedrig)

`.github/ISSUE_TEMPLATE/neues-gebaeude.yml` existiert, aber es gibt keine
Pull-Request-Vorlage.

**Aufgaben:**
- [ ] `.github/pull_request_template.md` anlegen (Beschreibung, Checkliste, Test-Hinweise).

---

## Mittelfristig (nächster Sprint / nächste 2–4 Wochen)

### P1 – Docker Compose für lokale Entwicklung (Aufwand: M | Impact: 🟢 hoch)

Aktuell muss PostgreSQL manuell installiert und konfiguriert werden.

**Aufgaben:**
- [ ] `docker-compose.yml` im Root anlegen (Services: `postgres`, `backend`).
- [ ] `backend/Dockerfile` erstellen.
- [ ] `README.md` um einen „Quick Start mit Docker" Abschnitt ergänzen.

---

### P1 – Einheitliche Fehlerresponses (Aufwand: M | Impact: 🟡 mittel)

Einige Routen geben inkonsistente Fehlerformate zurück.

**Aufgaben:**
- [ ] Standard-Fehlerformat definieren: `{ error: { message, code, details? } }`.
- [ ] `backend/middleware/errorHandler.js` auf dieses Format erweitern.
- [ ] Alle Route-Handler auf konsistentes Format prüfen.

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

### P2 – CONTRIBUTING.md erstellen (Aufwand: S | Impact: 🟢 hoch)

Externe Beitragende finden keine Anleitung zum Workflow.

**Aufgaben:**
- [ ] `CONTRIBUTING.md` im Root anlegen (Branch-Konvention, Commit-Style, PR-Prozess, Linting).
- [ ] In `README.md` verlinken.

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

### P2 – Release-Prozess / Semantic Versioning (Aufwand: M | Impact: 🟡 mittel)

`backend/package.json` steht auf `"version": "1.0.0"`, aber es gibt keinen
definierten Release-Prozess.

**Aufgaben:**
- [ ] Changelogformat festlegen (z. B. `CHANGELOG.md` nach „Keep a Changelog").
- [ ] GitHub-Releases-Workflow in `.github/workflows/` anlegen (Tag → Release).
- [ ] Semantic Versioning (`major.minor.patch`) im Team kommunizieren.

---

### P2 – Multi-Player-Session-Sicherheit (Aufwand: L | Risiko: 🔴 hoch)

Mit mehr Spielern steigen Angriffsflächen (Race Conditions, Token-Missbrauch).

**Aufgaben:**
- [ ] DB-Transaktionen für alle schreibenden Tick-Operationen sicherstellen.
- [ ] Account-Lockout nach mehreren fehlgeschlagenen Login-Versuchen.
- [ ] Rate-Limiter-Konfiguration in `.env` auslagern (derzeit Hardcode in
  `backend/middleware/rateLimiters.js`).

---

## Zusammenfassung nach Aufwand

| Priorität | Aufgabe | Aufwand | Risiko/Impact |
|-----------|---------|---------|---------------|
| P0 | Naming-Konsistenz | M | 🔴 Risiko hoch |
| P0 | LICENSE | S | 🟡 mittel |
| P0 | CORS absichern | S | 🔴 Risiko hoch |
| P1 | Frontend API-URL | S | 🟡 mittel |
| P1 | Tests Economy/Units | M | 🔴 Risiko hoch |
| P1 | PR-Template | S | 🟢 niedrig |
| P1 | Docker Compose | M | 🟢 Impact hoch |
| P1 | Fehlerresponses | M | 🟡 mittel |
| P1 | Logging | M | 🟡 mittel |
| P2 | OpenAPI Spec | L | 🟢 Impact hoch |
| P2 | CONTRIBUTING.md | S | 🟢 Impact hoch |
| P2 | Refresh Token | L | 🔴 Risiko hoch |
| P2 | Kampfsystem | XL | 🟢 Impact sehr hoch |
| P2 | Karten-System | XL | 🟢 Impact sehr hoch |
| P2 | Release-Prozess | M | 🟡 mittel |
| P2 | Multi-Player-Security | L | 🔴 Risiko hoch |
