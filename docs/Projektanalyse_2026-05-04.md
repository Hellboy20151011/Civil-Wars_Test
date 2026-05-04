# Projektanalyse und Verbesserungen (Stand: 2026-05-04)

## Ziel

Diese Analyse fasst technische Probleme, konkrete Verbesserungen, Strukturvorschlaege und Gameplay-Erweiterungen fuer Civil Wars zusammen.

## Gepruefter Umfang

- Backend-Lint: erfolgreich (`npm run lint` in `backend`)
- Backend-Tests: erfolgreich (`37/37` Tests, `npm test` in `backend`)
- Frontend-Lint: fehlgeschlagen (1 Fehler in `frontend/scripts/shell.js`)
- Code- und Doku-Sichtung in zentralen Dateien (`routes`, `services`, `repositories`, `docs`)

## Priorisierte Befunde

### P0 - Sofort beheben

1. Frontend-Lint-Fehler blockiert Qualitaets-Gate

- Datei: `frontend/scripts/shell.js`
- Befund: `requestAnimationFrame` wird von ESLint als `no-undef` gemeldet.
- Risiko: CI/Lint-Checks schlagen fehl, erhoehte Fehlerquote bei Refactorings.
- Empfehlung:

  - Entweder Browser-Globals im ESLint-Setup explizit setzen.
  - Oder `globalThis.requestAnimationFrame(...)` verwenden.

1. Inkonsistente Fehlerbehandlung in Route

- Datei: `backend/routes/me.js`
- Befund: Im SSE-Handler wird bei Serverfehlern direkt `res.status(500).json(...)` zurueckgegeben, statt via `next(err)` an den zentralen `errorHandler` zu delegieren.
- Risiko: inkonsistentes Error-Format, schwerer auswertbare Fehler fuer Clients.
- Empfehlung:

  - Fehler nach Rollback mit `throw err` weiterreichen (wie in den anderen Route-Abschnitten).

### P1 - Kurzfristig

1. Schichtenverletzung in mehreren Routen

- Dateien: `backend/routes/auth.js`, `backend/routes/buildings.js`, `backend/routes/me.js`
- Befund: Routen greifen direkt auf den DB-Pool zu und steuern SQL-Transaktionen (`BEGIN/COMMIT/ROLLBACK`) selbst.
- Risiko: Business-/Persistence-Logik verteilt sich in der HTTP-Schicht, erschwert Tests und Wartung.
- Empfehlung:

  - Transaktionsablaeufe ueber Service/Repository abstrahieren.
  - Routen auf Validierung/Auth/Response-Mapping begrenzen.

1. Konfigurationsbruch im Repository

- Datei: `backend/repositories/building.repository.js`
- Befund: `process.env.NODE_ENV` wird direkt verwendet (`TICK_MS`), statt zentral aus `backend/config.js`.
- Risiko: Inkonsistente Konfigurationsquelle, schwieriger zu testen.
- Empfehlung:

  - `TICK_MS` aus `config.gameloop.tickIntervalMs` bzw. aus einer klar benannten Konfigurationssektion beziehen.

1. Transaktionsgrenze bei Registrierung unklar

- Datei: `backend/routes/auth.js`
- Befund: Nach `COMMIT` wird noch Refresh-Token-Erzeugung mit demselben Client ausgefuehrt.
- Risiko: Teilweise persistierter Zustand moeglich (User angelegt, Refresh-Token fehlgeschlagen).
- Empfehlung:

  - Entweder Refresh-Token in dieselbe Transaktion aufnehmen.
  - Oder Erzeugung klar als zweite, explizite Transaktion kapseln (`withTransaction`).

### P2 - Mittelfristig

1. Doku-Qualitaet: viele Markdown-Lint-Probleme

- Dateien: vor allem `README.md`, `docs/next-steps.md`, `docs/Verbesserungs.md`
- Befund: Viele `MD032`/`MD060`/`MD040` Hinweise.
- Risiko: sinkende Doku-Qualitaet, schlechtere Lesbarkeit, unruhige CI/Editor-Problemliste.
- Empfehlung:

  - Einmalige Doku-Normalisierung (Tabellenstil, Listenabstaende, Codeblock-Sprachen).
  - Optional: markdownlint als separaten CI-Check definieren.

1. Changelog-Struktur wirkt inkonsistent

- Datei: `CHANGELOG.md`
- Befund: Sehr lange Abschnitte, mehrfache gleichnamige Untersektionen (`Changed`, `Fixed`) innerhalb derselben Version/Phase.
- Risiko: Historie schwer durchsuchbar, Releases schlechter nachzuvollziehen.
- Empfehlung:

  - Pro Release exakt eine klare Gliederung (`Added/Changed/Fixed/Security`).
  - Aeltere Eintraege bei Bedarf konsolidieren.

## Strukturverbesserungen (Architektur)

1. ✅ Route-Service-Repository strikter durchziehen

- Ziel: Keine DB-Operationen in `routes/`.
- Nutzen: Bessere Testbarkeit, geringere Kopplung, klarere Verantwortlichkeiten.

1. ✅ Einheitliches Transaktionsmuster

- Standardisieren: Nur `withTransaction(...)` verwenden (auch in Routen-nahen Flows).
- Nutzen: Weniger Fehler bei Rollback/Commit, einheitliches Verhalten.

1. ✅ Fehlercode-Katalog einfuehren

- Neben `message` einen stabilen `error.code` Katalog dokumentieren (z. B. `AUTH_INVALID_TOKEN`, `BUILDING_NOT_FOUND`, `INSUFFICIENT_RESOURCES`).
- Nutzen: Frontend kann Fehler robust und lokalisiert behandeln.

1. ✅ Service-Schicht fuer SSE-Einstieg staerken

- Initialstatus + Stream-Setup in Service kapseln.
- Nutzen: weniger Logik in Route, leichter unit-testbar.

1. ✅ Doku-Informationsarchitektur aufraeumen

- `docs/next-steps.md` fuer Roadmap, `docs/Verbesserungs.md` fuer Quality-Backlog, diese Analyse als Snapshot.
- Nutzen: weniger Ueberschneidungen, bessere Wartbarkeit der Doku.

## Gameplay-Erweiterungen (Ideen)

### Kurzfristig (schneller Mehrwert)

1. Auftrags- und Missionssystem

- Taegliche/Woechentliche Aufgaben (Bauen, Produzieren, Angreifen).
- Belohnungen: Ressourcen, zeitweise Buffs, kosmetische Titel.

1. Kampfberichte 2.0

- Detaillierte Battle-Logs mit Verlusten, Multiplikatoren, Counter-Effekten.
- Optional Replay-Ansicht in vereinfachter Form.

1. Einheitenrollen ausbauen

- Frontline, Support, Artillerie, Luftabwehr mit klaren Rollenboni.
- Erhoeht strategische Build-Variabilitaet.

### Mittelfristig (tieferes Meta)

1. Allianzsystem

- Allianzen, Rollen/Rechte, gemeinsame Ziele, Hilfstransporte.
- Spaeter: Allianzkriege und saisonale Wertung.

1. Gebiets- und Kontrollsystem

- Karte in Sektoren unterteilen, Boni fuer kontrollierte Gebiete.
- Konflikte um Schluesselzonen (z. B. Rohstoff-Hotspots).

1. Forschung/Technologiebaum

- Freischaltbare Tech-Pfade (Wirtschaft, Verteidigung, Mobilitaet, Aufklaerung).
- Trade-off-Entscheidungen statt linearer Progression.

### Langfristig (Retention + Endgame)

1. Saisonmodell

- Zeitlich begrenzte Saisons mit Reset/Soft-Reset und exklusiven Belohnungen.

1. Ereignisse und Weltzustand

- Dynamische Events (Energiekrise, Rohstoffboom, Wettereffekte) mit globalen Modifikatoren.

1. Logistik und Versorgung

- Versorgungslinien beeinflussen Kampfkraft/Bewegungsgeschwindigkeit.
- Karte wird strategisch wichtiger als reine Distanz.

## Empfohlene Umsetzungsreihenfolge

1. P0-Fixes: Frontend-Lint + Fehlerdelegation in `me.js`

1. P1-Refactor: DB/Transaktionen aus Routen herausziehen

1. Doku-Hygiene: markdownlint-Baustellen und Changelog-Konsolidierung

1. Gameplay-Quickwins: Missionen + verbesserte Kampfberichte

1. Strategische Features: Allianz + Gebiets-/Saisonsystem

## Zusammenfassung

Der technische Kern (Lint Backend, Service-Tests, Grundarchitektur, CI-Basis) ist solide. Die groessten kurzfristigen Hebel sind ein kleiner Frontend-Qualitaetsfix, konsistente Fehlerbehandlung und das konsequente Herausziehen von DB-/Transaktionslogik aus den Routen. Produktseitig bieten Missionen, Allianz-Mechaniken und ein Gebiets-/Saisonmodell den besten Mix aus schneller Wirkung und langfristiger Spielerbindung.
