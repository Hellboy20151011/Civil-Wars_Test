Civil Wars – Copilot Instructions

Changelog

Wann immer Code oder Konfiguration geändert wird, muss "CHANGELOG.md" unter
"## [Unreleased]" aktualisiert werden:

- "Added" – neue Dateien/Features
- "Changed" – Änderungen an bestehenden Dateien
- "Fixed" – Bug Fixes
- "Security" – Security-relevante Änderungen

---

Projekt-Konventionen

- Backend-Konfiguration immer über "backend/config.js" (nicht direkt "process.env")
- Neue konfigurierbare Werte immer auch in "backend/.env.example" dokumentieren
- Fehler in Routen immer via "next(err)" an den zentralen "errorHandler" delegieren
- Kein direktes "res.status(...).json(...)" für Serverfehler (4xx durch Validierung ist OK)
- Neue DB-Abfragen gehören in "backend/repositories/", nicht direkt in Services
- Alle DB-Abfragen müssen parametrierte Queries verwenden ("$1, $2, ...")
- Niemals SQL per String-Konkatenation oder Template-Literal mit Variablen bauen
- Kein Hardcode von "http://localhost:3000" im Frontend
- Immer "frontend/scripts/config.js" verwenden

---

Sprache / Naming

- DB-Spalten, API-Felder, JS-Variablen: Englisch
- Ausnahme bestehende Ressourcenfelder:
  - "geld"
  - "stein"
  - "stahl"
  - "treibstoff"
  - "strom"
- UI-Texte und Benutzeranzeigen: Deutsch

---

Dokumentation

Nach größeren Änderungen prüfen und aktualisieren:

- "README.md"
- "API_DOCUMENTATION.md"
- "VARIABLES.md"
- "docs/openapi.yaml"
- "docs/next-steps.md"
- "docs/Verbesserungs.md"
- "CHANGELOG.md"

Dokumentation darf niemals bewusst vom echten Codezustand abweichen.

---

Architektur

Schichten (von außen nach innen):

1. "routes/"
   
   - nur HTTP-Handling
   - keine Business-Logik

2. "services/"
   
   - Spiellogik
   - Validierung
   - Ablaufsteuerung

3. "repositories/"
   
   - alle DB-Zugriffe
   - keine Business-Logik

4. "database/db.js"
   
   - Connection Pool
   - nur von Repositories importieren

---

Projekt-Struktur

Siehe:

- "README.md"
- "CONTRIBUTING.md"
- "API_DOCUMENTATION.md"
- "VARIABLES.md"

---

Sicherheitsregeln

Frontend-Sicherheit

Verwende niemals "innerHTML" mit dynamischen Daten aus:

- API-Responses
- User-Input
- URL-Parametern
- SSE-Events

Bevorzugt:

- "textContent"
- "createElement"
- "appendChild"

Falls HTML notwendig ist:

- zentralen sicheren Renderer verwenden
- oder Inhalte vorher escapen

---

Backend-Sicherheit

- Keine Secrets im Repository speichern
- Keine ".env" committen
- Keine sensitiven Fehlerdetails an Clients senden
- JWT-/Token-Handling immer zentral halten
- Kurzlebige Tokens und Tickets kryptografisch sicher erzeugen ("crypto.randomBytes")
- Alle geschützten Endpunkte müssen Auth prüfen
- Neue öffentliche Endpunkte auf Rate-Limiting prüfen

---

API- und Event-Contracts

Wenn Backend-Responses, SSE-Events oder DTOs geändert werden:

müssen gleichzeitig geprüft werden:

- Frontend-Consumer
- SSE-Listener
- Tests
- OpenAPI
- API_DOCUMENTATION.md

Eventnamen und Payloadfelder müssen konsistent bleiben.

Keine Feldnamenänderungen ohne vollständige Consumer-Prüfung.

---

Ressourcenintegrität / Race Conditions

Alle Ressourcenänderungen müssen race-condition-sicher sein.

Besonders:

- Bau starten
- Forschung starten
- Einheitenbau
- Kampf
- Plünderung
- Produktion
- Ressourcenabzug

müssen:

- atomar
- transaktionsgesichert
- oder DB-seitig abgesichert sein

Negative Ressourcenbestände dürfen niemals möglich sein.

---

Datenbankregeln

- Neue Tabellen immer mit sinnvollen:
  
  - Foreign Keys
  - Constraints
  - Indizes

- Zeitspalten bevorzugt als "TIMESTAMPTZ"

- Stammdaten normalisieren statt Hardcoding

- Schemaänderungen müssen:
  
  - Migrationen
  - Seeds
  - Dokumentation
  - Tests
    synchron halten

---

Legacy-Regeln

Keine parallelen Altsysteme pflegen ohne Kennzeichnung.

Alte Systeme müssen:

- archiviert
- entfernt
- oder klar als "deprecated" markiert werden

Keine zweite Implementierung derselben Spiellogik ohne ausdrückliche Kennzeichnung.

---

Frontend-Modularität

Keine neuen großen Monolith-Dateien erweitern.

Wenn Dateien größer als ca. 300–400 Zeilen werden:

- neue Features in eigene Module auslagern

Trenne:

- API
- Rendering
- State
- Events
- Timer
- Utilities
- DOM-Manipulation

---

Spielsystem-Architektur

Neue Spielsysteme müssen modular aufgebaut werden.

Keine Spiellogik:

- direkt in HTML
- direkt in Routen
- direkt im DOM-Code

Spielregeln gehören in Services.

---

Naming- und Datei-Regeln

Dateinamen und Referenzen müssen exakt identisch sein.

Keine Mischformen wie:

- "Bauhof.html"
- "bauhof.html"

Bevorzugt:

- lowercase Dateinamen
- konsistente Namenskonventionen

---

Test-Regeln

Bei Änderungen an Spiellogik:

- bestehende Tests prüfen
- Mockdaten prüfen
- Assertions prüfen
- alte Feldnamen entfernen
- alte Geschäftslogik entfernen

Grüne, aber fachlich veraltete Tests gelten als Fehler.

Neue Features möglichst mit:

- Unit-Tests
- E2E-Tests
- oder Contract-Tests absichern

---

Repository-Hygiene

Keine:

- Exportdateien
- temporären Dateien
- Review-Entwürfe
- halbfertigen Analysen
- Testartefakte
- Beispiel-Exports

dauerhaft im Repository behalten.

"docs/" nur für gepflegte Projektdokumentation verwenden.

---

Performance-Regeln

Neue Features auf folgende Risiken prüfen:

- unnötige DB-Abfragen
- N+1-Probleme
- fehlende Pagination
- unnötiges Polling
- große Payloads
- ineffiziente Schleifen

Häufig genutzte Stammdaten bevorzugt zentral cachen.

---

Copilot-Analyse-Regeln

Wenn eine Analyse-Datei erstellt wird:

- gesamtes Repository rekursiv prüfen
- nicht nur geöffnete Dateien analysieren
- Frontend, Backend, DB, Tests, Docs und ".github" berücksichtigen

Immer prüfen:

- Sicherheitsprobleme
- Code-Dubletten
- Race Conditions
- Architekturprobleme
- Legacy-Code
- Inkonsistenzen
- Dokumentationsabweichungen
- ungenutzte Dateien
- veraltete Tests
- Event-/Payload-Mismatches

Probleme immer mit:

- Datei
- Zeile/Bereich
- Auswirkung
- Lösungsvorschlag

dokumentieren.

Keine allgemeinen Aussagen ohne Codebezug.

---

Bevorzugte Struktur neuer Frontend-Dateien

Empfohlene Struktur:

- "frontend/scripts/api/"
- "frontend/scripts/utils/"
- "frontend/scripts/events/"
- "frontend/scripts/components/"
- "frontend/scripts/modules/"

---

Build- und CI-Regeln

Neue Features dürfen:

- Linting
- Tests
- Builds
- CI
- Docker
- OpenAPI
- bestehende Scripts

nicht unbeabsichtigt brechen.

Änderungen an:

- package.json
- Docker
- CI
- Env
- Scripts

immer auf Seiteneffekte prüfen.

---

Wichtig

Codequalität ist wichtiger als schnelle Implementierung.

Keine Quickfixes erzeugen, die:

- technische Schulden erhöhen
- Architektur verschlechtern
- doppelte Systeme erzeugen
- Inkonsistenzen schaffen
- Dokumentation veralten lassen
- Sicherheitsprobleme verursachen
