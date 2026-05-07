# Changelog

Alle nennenswerten Änderungen an diesem Projekt werden hier dokumentiert.

Format: [Keep a Changelog](https://keepachangelog.com/de/1.0.0/)  
Versioning: [Semantic Versioning](https://semver.org/lang/de/)

---

## [Unreleased]

### Added

- `backend/database/migrate_v7_spy_stats.sql` – Migration: Spalten `spy_attack` und `spy_defense` in `unit_types`; setzt Werte für Spion (20/30), SR-71 Aufklärer (50/40), Spionagesatellit (120/60).
- `backend/database/migrate_v6_npc.sql` – Migration: Spalten `is_npc BOOLEAN` und `npc_type VARCHAR(20)` in `users`-Tabelle; Index `idx_users_is_npc`.
- `backend/repositories/npc.repository.js` – `findActiveNpcs()` und `createNpc()` für NPC-Accounts.
- `backend/services/npc.service.js` – KI-Tick-Service: NPCs bauen eigenständig Gebäude nach Priorität, trainieren Einheiten und (bei `aggressive`-Typ) starten Angriffe auf nahegelegene Spieler.
- `backend/scripts/seed-npcs.js` – Seed-Script zum Anlegen von 3 Test-NPCs (2× defensiv, 1× aggressiv).

### Changed

- `backend/services/espionage.service.js` – Komplettes Rework der Spionage-Logik: Ersetzt den probabilistischen Einzelspion-Ansatz durch ein aggregiertes Verhältnismodell. Neues System: `Gesamtangriff = SUM(spy_attack × quantity_sent)`, `Gesamtabwehr = SUM(spy_defense × quantity)`; vier Ergebnisstufen (Fehlschlag / Stufe 1–3) basierend auf dem Verhältnis; bei Fehlschlag gehen alle Spione verloren, bei Stufe 1–3 kehren alle zurück; Stufe 3 benachrichtigt den Verteidiger nicht.
- `backend/repositories/spy-missions.repository.js` – `findMissionUnits` um `spy_attack` erweitert; neue Funktionen `findTotalSpyDefense`, `findPlunderableBuildingCount`, `findProductionBuildingsForReport`, `findUnitDefenseTotalsForReport`.
- `backend/database/schemas/units.sql` – `unit_types`-Tabelle um Spalten `spy_attack` und `spy_defense` erweitert; UPDATE-Statements für Intel-Einheitenwerte ergänzt.
- `backend/services/buildings.service.js` – Infrastruktur- und Unterkunftsgebäude (Kategorie `infrastructure` / `housing`) werden mit jedem gebauten Exemplar um **3% linear** teurer (Formel: `floor(baseCost × (1 + n × 0,03))`). Konstanten `SCALABLE_CATEGORIES`, `COST_SCALE_PER_BUILDING` und Hilfsfunktion `calculateScaledTotal` hinzugefügt.
- `frontend/scripts/bauhof.js` – Baukostenanzeige und „Max baubar"-Berechnung berücksichtigen jetzt die gestaffelten Kosten für Infrastruktur- und Unterkunftsgebäude. Hilfsfunktionen `getScaledUnitCost`, `calcScaledTotal`, `maxBuildableWithScaling` sowie Konstanten `SCALABLE_CATEGORIES`/`COST_SCALE_RATE` ergänzt.

- `backend/services/gameloop-scheduler.js` – `npcService.tickAllNpcs()` wird am Ende jedes Ticks aufgerufen.

- `backend/data/combat-matchups.json` – Matchup-Matrix auf numerische Werte (`number`) und `null` normalisiert; Stringwerte (`"1,5"`) und `"x"` entfernt.
- `backend/services/combat.service.js` – Kampfauflösung auf deterministische, matrixbasierte Schadensverteilung umgestellt (`Anzahl × Angriff × Matchup`), Siegerermittlung auf relative Verlustquoten geändert (Verteidiger gewinnt bei Gleichstand), Plünderung auf `20 % Loot-Pool × Verteidiger-Verlustquote` umgestellt.
- `backend/repositories/combat-missions.repository.js` und `backend/services/combat.service.js` – Tageslimit ergänzt: maximal 6 Angriffe pro Tag je Angreifer→Verteidiger (`ATTACK_LIMIT_REACHED`).
- `backend/tests/services/combat.service.test.js` – Tests an neue Kampf-/Plünderlogik angepasst (inkl. Tageslimit-Mock und aktualisierter Plünderungsrate).
- `backend/tests/e2e/combat-plunder-flow.test.js` – Bestehenden Test auf 100 Angreifer-Einheiten und 5 Gebäude korrigiert; neuen `test.describe`-Block „Raid-Formel" mit 4 Szenarien ergänzt (10, 98, 100 Gebäude, Mindestschutz 1 Gebäude).
- `backend/services/combat.service.js` – Schadensverteilung auf mengengewichtete Zuteilung (`quantity × matchup` als Gewicht statt gleichmäßiger Aufteilung); `defense_points` in `toEffectiveHitpoints` integriert (`HP × (1 + defense_points / 100)`), wodurch defensive Einheiten robuster werden.
- `backend/tests/services/combat.service.test.js` – Erwartete `attackPower`-Werte an gewichtete Verteilung angepasst (3 Tests).
- `docs/next-steps.md` und `docs/Verbesserungs.md` – Kampfsystem-Fortschritt und Testumfang aktualisiert.

### Fixed

- `backend/services/combat.service.js` – Kampfverluste bei kleinen Einheitenmengen (z. B. 1 vs. 1) waren immer 0, weil `Math.floor(damage/HP)` bei Werten < 1 stets 0 ergibt. Verlustberechnung ersetzt durch **rundenbasierte Simulation** (`simulateCombatRounds`): Schaden akkumuliert sich pro Runde in einem Pool; erst wenn der Pool die effektiven HP einer Einheit erreicht, stirbt sie. `rounds` und `roundLog` werden im `combatResult` gespeichert.
- `frontend/scripts/kampfbericht.js` – Kampfbericht komplett neu gestaltet: farbiges Win/Loss-Banner, Kennzahlen-Grid, farbkodierte Einheitentabellen, ausklappbare Rundeneinzelübersicht mit Verlustmarkierung.
- `frontend/CSS/style.css` – Neue CSS-Klassen `.cb-banner`, `.cb-stats`, `.cb-stat`, `.cb-section`, `.cb-unit-grid`, `.cb-table`, `.cb-round-details`, `.cb-round-scroll` für den Kampfbericht ergänzt.

- `backend/services/espionage.service.js`, `backend/routes/espionage.js`, `backend/repositories/resources.repository.js`, `frontend/scripts/karte.js`, `frontend/scripts/spionage.js`, `backend/tests/services/espionage.service.test.js` – Spionage-Vorschau und Start synchronisiert: Erfolgsquote aus der Vorschau entfernt, Treibstoffbedarf berücksichtigt jetzt die gewählte Einheitenmenge, und Treibstoff wird beim Absenden serverseitig geprüft und sofort abgezogen (`INSUFFICIENT_RESOURCES` bei zu wenig Treibstoff).
- `frontend/scripts/shell.js`, `frontend/scripts/karte.js`, `frontend/scripts/spionage.js` – Spionage-UI zeigt verfügbaren Treibstoff direkt in der Vorschau, deaktiviert `Spione entsenden` bei zu wenig Treibstoff und aktualisiert Ressourcenanzeige nach erfolgreichem Absenden sofort ohne Seiten-Refresh.
- `frontend/pages/karte.html`, `frontend/CSS/style.css`, `frontend/scripts/karte.js`, `frontend/scripts/spionage.js` – Bei zu wenig Treibstoff wird zusätzlich ein gut sichtbarer Badge `Nicht genug Treibstoff` neben dem Senden-Button angezeigt.
- `backend/services/combat.service.js`, `backend/repositories/units.repository.js`, `backend/tests/services/combat.service.test.js`, `frontend/pages/karte.html`, `frontend/scripts/karte.js`, `frontend/scripts/kampf.js`, `frontend/scripts/shell.js` – Angriffe prüfen und buchen Treibstoff nun analog zur Spionage: serverseitige Prüfung/Abzug beim Start, Frontend zeigt Treibstoffbedarf + Verfügbarkeit, deaktiviert Start bei Mangel und aktualisiert Ressourcen direkt nach dem Absenden.
- `backend/services/combat.service.js`, `backend/repositories/units.repository.js`, `backend/tests/services/combat.service.test.js`, `frontend/scripts/karte.js`, `frontend/scripts/kampf.js` – Verteidigungsstellungen (`category = defense`) können nicht mehr für Angriffe ausgewählt oder per API gestartet werden; serverseitig wird mit `INVALID_UNIT_CATEGORY` abgewiesen.
- `backend/services/combat.service.js` und `backend/tests/services/combat.service.test.js` – Plünderung bei Angreifer-Sieg überträgt Gebäude jetzt korrekt vom Verteidiger auf den Angreifer (statt nur beim Verteidiger zu entfernen).
- `backend/services/combat.service.js` und `backend/tests/services/combat.service.test.js` – Angreiferverluste werden nur noch für Einheiten berechnet, die laut Matchup-Matrix vom Verteidiger überhaupt getroffen werden können (z. B. kein Seahawk-Verlust gegen reinen Soldaten-Verteidiger).
- `frontend/pages/missionen.html`, `frontend/scripts/missionen.js`, `frontend/scripts/shell.js`, `frontend/vite.config.js`, `backend/server.js` – Kampf- und Spionagefunktionen (laufende Missionen + Berichte) in neue zentrale Seite `Missionen` zusammengeführt.
- `frontend/pages/kampf.html`, `frontend/scripts/kampf.js`, `frontend/pages/spionage.html`, `frontend/scripts/spionage.js`, `frontend/scripts/karte.js` – `Kämpfe` und `Spionage` zu Planungsseiten umgestellt: Aufruf erfolgt über das Karten-Popup (`Angriff`/`Spionage`) mit Zielübergabe per Query-Parameter.
- `frontend/scripts/shell.js` – globale Forschungs-Queue-Anzeige im rechten Produktionspanel ergänzt (aktive Forschung + Live-Countdown); Status wird periodisch via `/research/overview` aktualisiert.
- `backend/database/schemas/research.sql`, `backend/database/migrate_v5_research.sql`, `backend/repositories/research.repository.js`, `backend/services/research.service.js`, `backend/routes/research.js`, `backend/server.js` – Persistentes Forschungssystem mit Projekten, Laufzeiten und API (`GET /research/overview`, `POST /research/start`) eingeführt.
- `frontend/scripts/forschungen.js` – Forschungen-Seite nutzt jetzt echte Forschungsprojekte aus dem Backend inkl. Start-Button, Live-Status und Restzeit.
- `backend/services/units.service.js` und `frontend/scripts/militaer.js` – Freischaltung von Verteidigungsstellungen auf abgeschlossene Verteidigungsforschung umgestellt (statt direkter Gebäudelevel-Logik).
- `backend/scripts/resetdb.js` – neues Forschungsschema `research.sql` in die Reset-Reihenfolge aufgenommen.
- `frontend/scripts/militaer.js` – Militärseite zeigt nun den aktuellen Forschungsstand (`Forschungslabor Level`) inkl. Verteidigungs-Freischaltstatus direkt oberhalb der Karten an.
- `frontend/pages/forschungen.html`, `frontend/scripts/forschungen.js`, `frontend/CSS/style.css`, `frontend/scripts/shell.js`, `frontend/vite.config.js`, `backend/server.js` – neue Seite `Forschungen` ergänzt (Navigation + Build/Route): zeigt Forschungsstufen und Freischaltstatus der Verteidigungsstellungen.
- `frontend/scripts/bauhof.js` und `frontend/scripts/shell.js` – Bauhof-Rubrik `Verteidigung` inkl. zugehöriger Frontend-Navigation/Filter-Logik entfernt.
- `frontend/scripts/militaer.js` und `backend/services/units.service.js` – Verteidigungsstellungen im Militär werden nun über Forschung freigeschaltet: statt Verteidigungsgebäuden gilt jetzt `Forschungslabor Level X` als Freischaltbedingung.
- `frontend/scripts/militaer.js` und `frontend/CSS/style.css` – Gesperrte Einheitenkarten zeigen jetzt zusätzlich ein gut sichtbares Schloss-Badge (`Gesperrt`) für schnellere Erkennbarkeit.
- `frontend/scripts/militaer.js` und `frontend/CSS/style.css` – Militäransicht auf Bauhof-Kartenlayout umgestellt; Einheiten werden jetzt ausgegraut und deaktiviert, wenn das erforderliche Gebäude noch nicht gebaut wurde (inkl. Hinweistext in der Karte).
- `frontend/CSS/style.css` – Bauhof-Button in Gebäudekarten optisch verkleinert und Action-Bereich mit zusätzlichem Innenabstand versehen, damit der `Bauen`-Button die Container-Ränder nicht mehr berührt.
- `frontend/scripts/bauhof.js` – Bauhof-Karten zeigen jetzt die vorhandene Anzahl pro Gebäudetyp (`Vorhanden: X`); der Aktionsbutton heißt in allen Fällen konsistent `Bauen`.
- `frontend/scripts/bauhof.js` – Neue Gebäudebilder aus `frontend/assets/images/buildings` für `Kraftwerk`, `Stahlwerk`, `Steinbruch`, `Ölpumpe` und `Öl-Raffinerie` direkt in der Bauhof-Kartenansicht zugeordnet (inkl. Namensvariante `Ölraffinerie`).
- `frontend/scripts/main.js` – Login-Seite zeigt waehrend der initialen Session-Pruefung jetzt einen kurzen Hinweis (`Session wird geprueft...`), damit der Redirect-Check nicht wie ein leerer Zwischenzustand wirkt.
- `frontend/scripts/main.js` – Login-Seite prüft beim Laden jetzt bestehende Session-Daten robust: nur bei gültigem Token (`GET /me`) erfolgt Auto-Redirect zum Dashboard, ungültige/stale Tokens werden bereinigt.
- `frontend/scripts/shell.js` – Logout-Weiterleitung auf Spielseiten vereinheitlicht: Redirect geht jetzt explizit auf `/pages/index.html` (Login) und nutzt `location.replace`, damit kein inkonsistenter Root-Redirect und kein direktes Zurückspringen auf geschützte Seiten entsteht.
- `frontend/scripts/main.js` – Login auf der Startseite funktioniert nun beim ersten Klick: Der `Login`-Button triggert direkt den Login-Request statt zuerst nur eine neue (leere) Login-Ansicht zu rendern.
- `backend/services/combat.service.js` – Angreifer gewann nicht gegen verteidigerlosen Spieler: Bei leerer `activeDefs`-Liste blieb `attackPower = 0`, was zu fälschlicher Niederlage führte. Frühzeitiger Sieg-Pfad eingefügt, der automatisch Sieg + 0 Verluste zurückliefert wenn der Verteidiger keine Einheiten hat.
- `backend/services/combat.service.js` – Falscher Funktionsaufruf `resolveMission` (existiert nicht) im no-defenders-Pfad korrigiert zu `updateMissionAfterCombat`.
- `frontend/scripts/spionage.js` – Reisezeit-Countdown auf sekundengenaues Ticking umgestellt (analog zu Kämpfen), inklusive korrektem Zeitfeld je Missionsstatus (`arrival_time`/`return_time`) für flüssigere Anzeige.
- `backend/services/espionage.service.js` – Ohne Gegenspionageverteidigung (`counterIntelLevel = 0`) ist Spionage jetzt garantiert erfolgreich: keine erwischten Spione, immer `successRatePercent = 100` im Bericht.
- `frontend/scripts/spionage.js` – Spionageberichte zeigen jetzt die Erfolgsquote (`successRatePercent`) explizit an.

### Added

- `backend/tests/e2e/combat-plunder-flow.test.js` – API-E2E-Regressionstest ergänzt, der den Kampf-Missionsfluss (Angriff starten, Kampf auflösen, Bericht prüfen) inklusive Gebäudeübertrag beim Angreifer-Sieg und Seahawk-vs-Soldat-Verlustlogik validiert.
- `backend/services/combat.service.js` + `backend/repositories/building.repository.js` – Plünderungsmechanik nach gewonnenem Kampf: 25 % der Unterkunfts- und Ressourcenproduktionsgebäude (inkl. Kraftwerke) des Verteidigers werden zerstört. Mindestens 1 Gebäude jedes Typs bleibt erhalten. Kraftwerke werden zuletzt entfernt und nur so weit, dass kein Stromdefizit beim Verteidiger entsteht. Ergebnis wird als `plunderedBuildings` im Kampfbericht gespeichert.
- `backend/repositories/combat-missions.repository.js` – Kampfberichte werden jetzt direkt nach dem Kampf sichtbar (`status IN ('traveling_back', 'completed')` statt nur `'completed'`); Sortierung auf `arrival_time` umgestellt
- `backend/repositories/spy-missions.repository.js` – Spionageberichte werden direkt nach Ankunft sichtbar (`status IN ('traveling_back', 'completed', 'aborted')`)
- `frontend/scripts/kampf.js` + `frontend/scripts/kampfbericht.js` – Berichtsdatum zeigt jetzt den Kampfzeitpunkt (`arrival_time`) statt der Rückkehrzeit; `kampfbericht.js` zeigt neuen Abschnitt „Geplünderte Gebäude" mit Anzahl zerstörter und verbleibender Gebäude – granulare 29×29 Einheit-vs-Einheit-Multiplikatortabelle für das Kampfsystem (ersetzt die kategorie-basierten Hardcodes)
- `frontend/pages/kampf.html` – neue Kampfseite mit Tabs für laufende Kämpfe und Kampfberichte
- `frontend/scripts/kampf.js` – Frontend-Logik für Missionslisten, Live-Countdowns und Berichtsanzeige aus `/combat/missions`, `/combat/incoming` und `/combat/history`
- `frontend/pages/kampfbericht.html` – neue Detailseite für einen einzelnen Kampfbericht
- `frontend/scripts/kampfbericht.js` – lädt und rendert Detaildaten eines Kampfberichts inkl. Einheitenvergleich
- `backend/utils/game-math.js` – gemeinsame Hilfsfunktionen `calcDistance()` und `calcArrivalTime()` (P5: DRY-Refactor aus combat/espionage)
- `backend/tests/services/combat.service.test.js` – 18 Unit-Tests für combat.service.js (P1: Matchup-Logik, Kampftaucher-Sonderregel, Fehlerbehandlung, Rückkehr-Abschluss)
- `backend/tests/services/espionage.service.test.js` – 20 Unit-Tests für espionage.service.js (P1: Missions-Validierung, Erfolgsformel, Berichte, Preview)
- `backend/tests/services/buildings.service.test.js` – 27 Unit-Tests für buildings.service.js (Bau, Upgrade, Queue, Ressourcen- und Stromprüfungen)
- `backend/tests/services/auth.service.test.js` – 12 Unit-Tests für register/login/refresh inkl. Koordinaten-Retry, Lockout- und Refresh-Token-Pfaden
- `backend/tests/services/me.service.test.js` – 2 Unit-Tests für Status- und Stream-Payload-Aufbau
- `.github/CODEOWNERS` – automatische Reviewer-Zuweisung für alle Pull Requests (P6)

### Fixed

- `.github/workflows/ci.yml` – `actions/checkout` und `actions/setup-node` von nicht-existenter `@v6` auf stabile `@v4` korrigiert (CI-Fehler behoben)
- `.github/workflows/release.yml` – gleiche Korrektur wie `ci.yml`

### Changed

- `backend/server.js`, `backend/config.js`, `backend/.env.example` – statische Frontend-Auslieferung nutzt `frontend/dist` standardmäßig nur in `production`; für explizites Umschalten wurde `FRONTEND_PREFER_DIST` ergänzt.
- `frontend/scripts/bauhof.js` und `frontend/CSS/style.css` – Bauhof-Rubrikansicht rendert Gebäudetypen jetzt als einzelne Karten mit Gebäudebild, Typ-Beschreibung, Strombedarf sowie maximal baubarer Anzahl (in Klammern) basierend auf verfügbarem Strom und Ressourcen
- `backend/services/combat.service.js` – Matchup-Logik auf unit-vs-unit-Tabelle (`combat-matchups.json`) umgestellt; `MATCHUP`-Konstante, `getMatchup()` und Counter-Bonus-Hardcode entfernt; neue `getUnitMatchup()`-Funktion liest direkt Einheit-Namen aus der JSON
- `backend/routes/combat.js` – neuer Endpoint `GET /combat/history/:missionId` für Detailansicht eines einzelnen Kampfberichts
- `backend/repositories/combat-missions.repository.js` und `backend/services/combat.service.js` – Einzelabfrage für Kampfberichte ergänzt; Kampfergebnis enthält bei `attackerUnits` jetzt zusätzlich `sent` und `losses`
- `frontend/scripts/shell.js` – Sidebar um Navigationseintrag `Kämpfe` erweitert und Combat-SSE-Events als CustomEvents (`combat-incoming`, `combat-result`, `combat-return`) für Seiten-Refresh weitergereicht
- `.github/workflows/release.yml` – GitHub-Release nutzt jetzt `softprops/action-gh-release@v2` und führt vor dem Release zusätzlich Playwright-E2E-Tests aus
- `backend/database/schemas/users.sql` – Unique-Constraint `users_coordinates_unique` für `(koordinate_x, koordinate_y)` ergänzt
- `backend/database/migrate_v4_user_coordinates.sql` – Migration für den neuen Koordinaten-Unique-Constraint ergänzt
- `backend/services/economy.service.js` – `TICK_MS` wird jetzt aus `config.gameloop.tickIntervalMs` gelesen statt hardcoded 60 s (P4)
- `backend/services/combat.service.js` – `calcDistance`/`calcArrivalTime` durch Import aus `utils/game-math.js` ersetzt; unbenutzten `config`-Import entfernt (P5)
- `backend/services/espionage.service.js` – `calcDistance`/`calcArrivalTime` durch Import aus `utils/game-math.js` ersetzt (P5)
- `backend/services/gameloop.js` – ungenutzte, redundante Alt-Implementierung entfernt; aktiver Tick verbleibt in `gameloop-scheduler.js`
- `backend/services/live-updates.service.js` – Stream-Ticket-System hinzugefügt: `createStreamTicket()` und `redeemStreamTicket()` für kurzlebige SSE-Einmal-Token (P2)
- `backend/routes/me.js` – SSE-Authentifizierung von JWT-im-URL auf `POST /me/stream-ticket` + `?ticket=` umgestellt; JWT-Import entfernt (P2)
- `backend/routes/auth.js` – direkte `res.status(error.status).json(...)` durch `next(err)` via `asyncWrapper` ersetzt (P3)
- `backend/routes/combat.js` – direkte Fehlerantworten durch Weitergabe an `errorHandler` über `asyncWrapper` ersetzt (P3)
- `backend/routes/espionage.js` – direkte Fehlerantworten durch Weitergabe an `errorHandler` über `asyncWrapper` ersetzt (P3)
- `backend/tests/services/economy.service.test.js` – 2 Tests für `getSpielerStatus` ergänzt; Coverage auf 100 % aller Metriken gebracht
- `backend/tests/services/combat.service.test.js` – 6 Tests für Matchup-Sonderfälle ergänzt (immune branch, Panzergrenadier, Fregatte, counter_unit-Bonus, setUnitHealth, null quantity_returned); Branch-Coverage auf 95 % verbessert
- `backend/tests/services/espionage.service.test.js` – 5 Tests ergänzt: SR-71/Satellit-Bonus, Low/Medium-Detail-Bericht, vollständiger Bericht mit Einheitenliste, Fehlerbehandlung in processReturningSpyMissions; Statement-Coverage auf 99 %, Line-Coverage auf 100 %
- `backend/routes/units.js` – direkte Fehlerantworten durch Weitergabe an `errorHandler` über `asyncWrapper` ersetzt (P3)
- `backend/server.js` – explizite HTML-Routen für `spionage.html` und `geheimdienstzentrum.html` ergänzt
- `frontend/scripts/shell.js` – `startLiveUpdates()` holt nun zuerst ein kurzlebiges Ticket via `POST /me/stream-ticket` statt den JWT im URL zu übergeben (P2)
- `.github/workflows/ci.yml` – `permissions: contents: read` auf Workflow-Ebene gesetzt (P8); Playwright-Browser-Installation `npx playwright install --with-deps chromium` im E2E-Job ergänzt (P7)
- `docker-compose.yml` – `POSTGRES_PASSWORD` auf `${POSTGRES_PASSWORD:-postgres}` umgestellt (P9)
- `backend/.env.example` – `POSTGRES_PASSWORD`-Hinweis für Docker Compose ergänzt (P9)
- `backend/tests/services/economy.service.test.js` – `TICK_MS` wird jetzt aus `config.gameloop.tickIntervalMs` importiert statt hardcoded
- `backend/vitest.config.js` – `buildings.service.js` wieder in die Coverage aufgenommen; Gesamt-Coverage liegt nun bei 93.17 % Statements, 80.76 % Branches, 92.79 % Functions und 94.63 % Lines
- `backend/tests/services/gameloop-scheduler.test.js` – um Guard-, Fehler- und Intervall-Pfade erweitert; `gameloop-scheduler.js` jetzt bei 100 % Branch-Coverage
- `backend/tests/services/auth.service.test.js`, `backend/tests/services/buildings.service.test.js`, `backend/tests/services/combat.service.test.js`, `backend/tests/services/espionage.service.test.js`, `backend/tests/services/gameloop-scheduler.test.js` – zusätzliche Branch-Tests für bisher ungetroffene Fehler- und Randpfade ergänzt; aktuelle Backend-Gesamt-Coverage: 99.04 % Statements, 91.95 % Branches, 98.19 % Functions, 99.82 % Lines
- `backend/repositories/player.repository.js` und `backend/services/auth.service.js` – fehlgeschlagene Logins zählen atomisch via `UPDATE ... RETURNING`; Registrierung fängt Koordinatenkonflikte per Retry auf
- `docs/Projektanalyse_2026-05-05.md` und `docs/next-steps.md` – veraltete Review- und Roadmap-Einträge an den aktuellen Umsetzungsstand angepasst

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

- `frontend/scripts/bauhof.js` und `frontend/CSS/style.css` – klickbare Maximal-Bauzahl `(x)` im Bauhof als separates UI-Element umgesetzt; Klick übernimmt den Maximalwert zuverlässig ins Anzahlfeld ohne sofortigen Bau
- `frontend/scripts/bauhof.js` und `frontend/CSS/style.css` – Bauhof aktualisiert Maximal-Bauzahl nach einem Bauauftrag sofort ohne Seiten-Refresh (lokale Status-Aktualisierung + `no-store` Fetch für frische `/me`-Daten) und markiert die aktualisierte `(max)`-Anzeige kurz visuell
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
