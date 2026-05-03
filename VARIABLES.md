# Variablen & Konstanten – Civil Wars Test

Auflistung aller benannten Variablen, Konstanten und Module-Exports im Projekt, geordnet nach Datei.

---

## Backend

### `backend/database/db.js`

| Name | Typ | Beschreibung |
|------|-----|--------------|
| `Pool` | Klasse (destrukturiert aus `pg`) | PostgreSQL-Connection-Pool-Klasse |
| `pool` | `Pool`-Instanz | Globaler Datenbankverbindungspool; Verbindungsdaten kommen aus `.env`. Standardwerte: host `localhost`, DB `civil_wars_test`, port `5432` |

---

### `backend/.env` (Umgebungsvariablen)

| Name | Beispielwert | Beschreibung |
|------|-------------|--------------|
| `DB_USER` | `postgres` | PostgreSQL-Benutzername |
| `DB_HOST` | `localhost` | Datenbankhost |
| `DB_NAME` | `civil_wars_test` | Name der Datenbank |
| `DB_PASSWORD` | `1234` | Datenbankpasswort |
| `DB_PORT` | `5432` | Datenbankport |
| `PORT` | `3000` | HTTP-Port des Express-Servers |
| `JWT_SECRET` | *(geheimer Schlüssel)* | Signierungsschlüssel für JWT-Tokens |
| `JWT_EXPIRES_IN` | `7d` | Gültigkeitsdauer eines JWT-Tokens |

---

### `backend/scripts/server.js`

| Name | Typ | Beschreibung |
|------|-----|--------------|
| `app` | Express-App | Zentrale Express-Anwendungsinstanz |
| `PORT` | `number` | HTTP-Port; aus `process.env.PORT`, Fallback `3000` |
| `FRONTEND_DIR` | `string` | Absoluter Pfad zum `frontend/`-Ordner; wird für statische Dateiauslieferung verwendet |
| `__filename` | `string` | Absoluter Pfad zur aktuellen Datei (ESM-Äquivalent zu `__filename`) |
| `__dirname` | `string` | Verzeichnis der aktuellen Datei (ESM-Äquivalent zu `__dirname`) |

---

### `backend/scripts/auth.js`

| Name | Typ | Beschreibung |
|------|-----|--------------|
| `router` | `express.Router` | Router-Instanz für alle `/auth`-Endpunkte |
| `JWT_SECRET` | `string` | JWT-Signierungsschlüssel aus `process.env.JWT_SECRET`; wirft Fehler wenn nicht gesetzt |
| `JWT_EXPIRES_IN` | `string` | Gültigkeitsdauer des JWT aus `process.env.JWT_EXPIRES_IN`, Fallback `'7d'` |
| `registerSchema` | `z.ZodObject` | Zod-Schema für Registrierung: `username` (min. 3 Zeichen), `email` (gültige E-Mail), `password` (min. 8 Zeichen) |
| `loginSchema` | `z.ZodObject` | Zod-Schema für Login: `username` (nicht leer), `password` (nicht leer) |
| `existing` | Query-Ergebnis | Prüft ob Username oder E-Mail bereits vergeben ist |
| `hashedPassword` | `string` | bcrypt-Hash des Passworts (saltRounds = 10) |
| `koordinateX` | `number` | Zufällige X-Koordinate (1–999) für neue Spieler auf der Weltkarte |
| `koordinateY` | `number` | Zufällige Y-Koordinate (1–999) für neue Spieler auf der Weltkarte |
| `versuche` | `number` | Zähler für Versuche freie Koordinaten zu finden (max. 50) |
| `client` | `PoolClient` | Datenbankverbindung aus dem Pool für transaktionssichere Registrierung |
| `newUser` | Objekt | Neu angelegter Datenbankuser; enthält `id`, `username`, `email`, `role`, `is_active`, `created_at` |
| `rathaus` | Objekt \| `null` | Gebäudetyp-Eintrag für das Rathaus; wird bei Registrierung als Startgebäude eingebucht |
| `payload` | Objekt | JWT-Payload: `{ id, username, role }` |
| `token` | `string` | Signiertes JWT für den eingeloggten User |
| `user` | Objekt | Datenbankzeile des gefundenen Users beim Login |
| `isPasswordValid` | `boolean` | Ergebnis des bcrypt-Vergleichs von Eingabe-Passwort und gespeichertem Hash |
| `authHeader` | `string \| undefined` | Wert des `Authorization`-Headers aus dem Request |

**Exports:** `requireAuth` (Middleware-Funktion), `default` (Router)

---

### `backend/scripts/resources.js`

| Name | Typ | Beschreibung |
|------|-----|--------------|
| `router` | `express.Router` | Router-Instanz für alle `/resources`-Endpunkte |

**Exports:** `default` (Router)

---

### `backend/scripts/buildings.js`

| Name | Typ | Beschreibung |
|------|-----|--------------|
| `router` | `express.Router` | Router-Instanz für alle `/buildings`-Endpunkte |
| `buildSchema` | `z.ZodObject` | Zod-Schema für `POST /build`: `building_type_id` (positive Ganzzahl), `anzahl` (min. 1, Default 1) |
| `building_type_id` | `number` | Aus dem Request-Body: ID des zu bauenden Gebäudetyps |
| `anzahl` | `number` | Aus dem Request-Body: Anzahl der zu bauenden Einheiten |
| `client` | `PoolClient` | Datenbankverbindung für transaktionssichere Bauauftrags-Verarbeitung |
| `bt` | Objekt \| `null` | Gebäudetyp-Datensatz aus `building_types`; enthält Kosten und Produktionswerte |
| `strom` | Objekt | Strom-Status `{ produktion, verbrauch, frei }` aus `getStromStatus` |
| `resources` | Objekt | Ressourcen des Users (mit `FOR UPDATE` Lock): `{ geld, stein, eisen, treibstoff }` |
| `kaserneAnzahl` | `number` | Aktuelle Anzahl gebauter Kasernen; für Limit-Check (max. 1) |
| `totalKosten` | Objekt | Gesamtkosten für `anzahl` × Einzelkosten: `{ geld, stein, eisen, treibstoff }` |
| `queueEntry` | Objekt \| `null` | Vorhandener Queue-Eintrag für denselben Gebäudetyp |

**Exports:** `default` (Router)

---

### `backend/scripts/me.js`

| Name | Typ | Beschreibung |
|------|-----|--------------|
| `router` | `express.Router` | Router-Instanz für den `/me`-Endpunkt |
| `client` | `PoolClient` | Datenbankverbindung für die aggregierte Status-Abfrage |
| `status` | Objekt | Kompletter Spielerstatus aus `getSpielerStatus`: `{ resources, buildings, queue, strom, production, bevoelkerung }` |

**Exports:** `default` (Router)

---

### `backend/middleware/asyncWrapper.js`

| Name | Typ | Beschreibung |
|------|-----|--------------|
| `asyncWrapper` | Funktion (Higher-Order) | Wrapping-Funktion für async Route-Handler; leitet Fehler automatisch an `next()` weiter |

**Exports:** `asyncWrapper`

---

### `backend/middleware/validate.js`

| Name | Typ | Beschreibung |
|------|-----|--------------|
| `validateBody` | Funktion (Higher-Order) | Middleware-Factory: nimmt ein Zod-Schema und gibt eine Middleware zurück; bei Fehler → `400` mit Fehlermeldung |

**Exports:** `validateBody`

---

### `backend/middleware/rateLimiters.js`

| Name | Typ | Beschreibung |
|------|-----|--------------|
| `authLimiter` | Rate-Limiter-Middleware | Schutz für Login/Register: max. **20 Anfragen** pro **15 Minuten** |
| `apiLimiter` | Rate-Limiter-Middleware | Schutz für Spiel-Endpunkte: max. **120 Anfragen** pro **1 Minute** |

**Exports:** `authLimiter`, `apiLimiter`

---

### `backend/middleware/errorHandler.js`

| Name | Typ | Beschreibung |
|------|-----|--------------|
| `errorHandler` | Funktion (4-arg Express-Middleware) | Zentraler Fehlerhandler; sendet `err.status ?? 500` mit `err.message ?? 'Interner Serverfehler'` |

**Exports:** `errorHandler`

---

### `backend/repositories/player.repository.js`

| Name | Typ | Beschreibung |
|------|-----|--------------|
| `findById` | async Funktion | Sucht User anhand `id`; gibt `{ id, email, username, role, is_active, koordinate_x, koordinate_y, created_at }` zurück |
| `findByUsernameOrEmail` | async Funktion | Prüft ob Username oder E-Mail bereits existiert; gibt `{ id }` oder `null` zurück |
| `findByUsername` | async Funktion | Lädt User für Login; gibt `{ id, username, email, password_hash, role, is_active }` oder `null` zurück |
| `create` | async Funktion | Legt neuen User an mit Koordinaten; gibt zurück: `{ id, email, username, role, is_active, created_at }` |
| `findByKoordinaten` | async Funktion | Prüft ob Koordinaten `(x, y)` bereits belegt sind; gibt `{ id }` oder `null` zurück |
| `updateLastLogin` | async Funktion | Setzt `last_login_at = NOW()` für den User |

**Exports:** alle Funktionen als benannte Exports

---

### `backend/repositories/resources.repository.js`

| Name | Typ | Beschreibung |
|------|-----|--------------|
| `initForUser` | async Funktion | Legt Startressourcen an: `geld=100`, `stein=500`, `eisen=300`, `treibstoff=0`; ON CONFLICT DO NOTHING |
| `findByUserIdLocked` | async Funktion | Liest Ressourcen mit `FOR UPDATE`-Lock für transaktionssichere Buchungen |
| `findByUserId` | async Funktion | Liest Ressourcen ohne Lock (nur Anzeige) |
| `addResources` | async Funktion | Addiert Tick-Produktion auf alle Ressourcen und aktualisiert `letzte_aktualisierung` |
| `deductResources` | async Funktion | Zieht Kosten von Ressourcen ab (Gebäudebau, Einheitenkauf etc.) |

**Exports:** alle Funktionen als benannte Exports

---

### `backend/repositories/building.repository.js`

| Name | Typ | Beschreibung |
|------|-----|--------------|
| `findAllTypes` | async Funktion | Gibt alle Gebäudetypen aus `building_types` sortiert nach `id` zurück |
| `findTypeById` | async Funktion | Sucht Gebäudetyp anhand `id` |
| `findTypeByName` | async Funktion | Sucht Gebäudetyp anhand `name` (z. B. `'Rathaus'`) |
| `findBuildingsByUser` | async Funktion | Gibt alle gebauten Gebäude eines Users zurück (JOIN mit `building_types`), inkl. `anzahl` |
| `findBuildingCountByName` | async Funktion | Gibt die Anzahl eines bestimmten Gebäudes (nach Name) für einen User zurück; `0` wenn nicht vorhanden |
| `upsertBuilding` | async Funktion | Fügt Gebäude ein oder erhöht `anzahl` bei vorhandenem Eintrag (ON CONFLICT DO UPDATE) |
| `findQueueByUser` | async Funktion | Gibt alle Bauaufträge eines Users sortiert nach `fertig_am` zurück |
| `findExistingQueueEntry` | async Funktion | Prüft ob ein noch nicht fertiger Bauauftrag für denselben Typ existiert |
| `createQueueEntry` | async Funktion | Erstellt neuen Bauauftrag mit `fertig_am = NOW() + bauzeit_minuten` |
| `findFinishedQueueEntries` | async Funktion | Gibt alle fertiggestellten Bauaufträge zurück (`fertig_am <= NOW()`) |
| `deleteFinishedQueueEntries` | async Funktion | Löscht alle abgeschlossenen Bauaufträge eines Users |

**Exports:** alle Funktionen als benannte Exports

---

### `backend/services/economy.service.js`

| Name | Typ | Beschreibung |
|------|-----|--------------|
| `TICK_MS` | `number` (Konstante) | Tick-Dauer in Millisekunden: `60 * 1000` = **1 Minute** |
| `getStromStatus` | async Funktion | Berechnet Strom-Bilanz aus gebauten Gebäuden; gibt `{ produktion, verbrauch, frei }` zurück |
| `getProductionPerTick` | async Funktion | Summiert Ressourcenproduktion aller Gebäude; gibt `{ geld, stein, eisen, treibstoff, bevoelkerung }` zurück |
| `applyProductionTicks` | async Funktion | Berechnet vergangene Ticks seit letztem Update, wendet Produktion auf Ressourcen an; gibt Anzahl verarbeiteter Ticks zurück |
| `processFinishedQueue` | async Funktion | Bucht fertige Bauaufträge als Gebäude ein und löscht sie aus der Queue; gibt Anzahl verarbeiteter Einträge zurück |
| `getSpielerStatus` | async Funktion | Aggregiert kompletten Spielerstatus: `{ resources, buildings, queue, strom, production, bevoelkerung }` |

**Interne Variablen in `applyProductionTicks`:**

| Name | Typ | Beschreibung |
|------|-----|--------------|
| `resources` | Objekt | Aktuelle Ressourcen des Users mit `letzte_aktualisierung` (mit Lock) |
| `now` | `Date` | Aktueller Zeitstempel für Tick-Berechnung |
| `elapsed` | `number` | Vergangene Zeit in ms seit `letzte_aktualisierung` |
| `ticks` | `number` | Anzahl vollständiger Ticks seit letztem Update (`Math.floor(elapsed / TICK_MS)`) |
| `production` | Objekt | Produktionsrate pro Tick aus `getProductionPerTick` |

**Exports:** `getStromStatus`, `getProductionPerTick`, `applyProductionTicks`, `processFinishedQueue`, `getSpielerStatus`

---

## Frontend

### `frontend/scripts/main.js`

| Name | Typ | Beschreibung |
|------|-----|--------------|
| `API_BASE_URL` | `string` | Basis-URL für alle API-Anfragen: `'http://localhost:3000'` |
| `pendingRegistration` | `{ username, password } \| null` | Zwischenspeicher für Schritt 1 der zweistufigen Registrierung (Username + Passwort) |

**Lokale Variablen in Funktionen:**

| Name | Kontext | Beschreibung |
|------|---------|--------------|
| `Name` | `renderRegister` | Eingegebener Username (getrimmt) |
| `Passwort` | `renderRegister` | Eingegebenes Passwort |
| `email` | `submitRegisterEmail` | Eingegebene E-Mail-Adresse (getrimmt) |
| `emailPattern` | `submitRegisterEmail` | Regex für einfache E-Mail-Validierung |
| `response` | `submitRegisterEmail` | HTTP-Response der Registrierungsanfrage |

---

### `frontend/scripts/shell.js`

| Name | Typ | Beschreibung |
|------|-----|--------------|
| `API_BASE_URL` | `string` | Basis-URL für API-Aufrufe: `'http://localhost:3000'` |

**In `renderResourceBar`:**

| Name | Typ | Beschreibung |
|------|-----|--------------|
| `res` | Objekt | Ressourcen-Teil des Status (`geld`, `stein`, `eisen`, `treibstoff`) |
| `strom` | Objekt | Strom-Teil des Status; zeigt `frei` (freie Kapazität) an |
| `bevoelkerung` | `number` | Bevölkerungszahl aus dem Status |
| `items` | Array | Liste der darzustellenden Ressourcen: `[{ key, label, value }]` |

**In `renderProductionPanel`:**

| Name | Typ | Beschreibung |
|------|-----|--------------|
| `prod` | Objekt | Produktionsraten aus `status.production` |
| `rows` | Array | Liste der darzustellenden Produktionszeilen: `[{ label, key }]` |

**In `renderSidebar`:**

| Name | Typ | Beschreibung |
|------|-----|--------------|
| `defaultLinks` | Array | Standard-Navigationslinks: Dashboard, Bauhof |
| `links` | Array | Zusammenführung aus `defaultLinks` und zusätzlichen `navLinks` |
| `logoutBtn` | `HTMLButtonElement` | Logout-Button; löscht `sessionStorage` und leitet zu `/` weiter |

**Exports:** `getAuth`, `initShell`

---

### `frontend/scripts/dashboard.js`

| Name | Typ | Beschreibung |
|------|-----|--------------|
| `auth` | `{ user, token } \| null` | Auth-Daten aus `sessionStorage`; bei `null` Redirect zur Startseite |
| `container` | `HTMLElement` | `#Dashboard`-Element für dynamischen Inhalt |
| `heading` | `HTMLHeadingElement` | `<h2>` mit Willkommenstext |
| `role` | `HTMLParagraphElement` | `<p>` mit Rollenanzeige |

---

## Datenbankschema (`backend/database/setup.sql`)

### Tabelle `users`

| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| `id` | `SERIAL PRIMARY KEY` | Eindeutige User-ID |
| `username` | `VARCHAR(50) UNIQUE NOT NULL` | Anzeigename |
| `email` | `VARCHAR(255) UNIQUE NOT NULL` | E-Mail-Adresse |
| `password_hash` | `VARCHAR(255) NOT NULL` | bcrypt-Hash des Passworts |
| `role` | `VARCHAR(20) DEFAULT 'player'` | Rolle: `'player'` oder `'admin'` |
| `is_active` | `BOOLEAN DEFAULT TRUE` | Account aktiv/gesperrt |
| `koordinate_x` | `INT` | X-Position auf der Weltkarte (1–999) |
| `koordinate_y` | `INT` | Y-Position auf der Weltkarte (1–999) |
| `created_at` | `TIMESTAMPTZ DEFAULT NOW()` | Registrierungszeitpunkt |
| `last_login_at` | `TIMESTAMPTZ` | Letzter Login-Zeitpunkt |

### Tabelle `user_resources` (flach, 1 Zeile pro User)

| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| `user_id` | `INT PRIMARY KEY` | Referenz auf `users.id` |
| `geld` | `NUMERIC DEFAULT 0` | Aktuelles Guthaben |
| `stein` | `NUMERIC DEFAULT 0` | Aktuelle Steinmenge |
| `eisen` | `NUMERIC DEFAULT 0` | Aktuelle Eisenmenge |
| `treibstoff` | `NUMERIC DEFAULT 0` | Aktuelle Treibstoffmenge |
| `letzte_aktualisierung` | `TIMESTAMPTZ DEFAULT NOW()` | Zeitstempel des letzten Tick-Updates |

### Tabelle `building_types`

| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| `id` | `SERIAL PRIMARY KEY` | Eindeutige Gebäudetyp-ID |
| `name` | `VARCHAR(100) UNIQUE NOT NULL` | Name des Gebäudetyps |
| `kategorie` | `VARCHAR(50)` | Kategorie: `Regierung`, `Versorgung`, `Unterkunft`, `Industrie`, `Militär` |
| `description` | `TEXT` | Beschreibungstext |
| `money_cost` | `INT DEFAULT 0` | Geldkosten |
| `stone_cost` | `INT DEFAULT 0` | Steinkosten |
| `steel_cost` | `INT DEFAULT 0` | Stahlkosten |
| `fuel_cost` | `INT DEFAULT 0` | Treibstoffkosten |
| `build_time` | `INT DEFAULT 1` | Bauzeit in Minuten |
| `money_production` | `INT DEFAULT 0` | Geldproduktion pro Tick |
| `stone_production` | `INT DEFAULT 0` | Steinproduktion pro Tick |
| `steel_production` | `INT DEFAULT 0` | Stahlproduktion pro Tick |
| `fuel_production` | `INT DEFAULT 0` | Treibstoffproduktion pro Tick |
| `power_production` | `INT DEFAULT 0` | Stromproduktion pro Tick |
| `power_consumption` | `INT DEFAULT 0` | Stromverbrauch pro Tick |
| `population` | `INT DEFAULT 0` | Bevölkerung die dieses Gebäude bereitstellt |

### Tabelle `user_buildings`

| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| `id` | `SERIAL PRIMARY KEY` | Eindeutige ID |
| `user_id` | `INT` | Referenz auf `users.id` |
| `building_type_id` | `INT` | Referenz auf `building_types.id` |
| `anzahl` | `INT DEFAULT 1` | Anzahl gebauter Einheiten dieses Typs |
| `UNIQUE(user_id, building_type_id)` | – | Nur ein Eintrag pro User/Gebäudetyp-Kombination |

### Tabelle `bau_auftraege` (Bauwarteschlange)

| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| `id` | `SERIAL PRIMARY KEY` | Eindeutige Auftrags-ID |
| `user_id` | `INT` | Referenz auf `users.id` |
| `building_type_id` | `INT` | Referenz auf `building_types.id` |
| `anzahl` | `INT DEFAULT 1` | Anzahl zu bauender Einheiten |
| `fertig_am` | `TIMESTAMPTZ NOT NULL` | Fertigstellungszeitpunkt |
| `erstellt_am` | `TIMESTAMPTZ DEFAULT NOW()` | Zeitpunkt der Auftragserteilung |

### Tabelle `kaserne_stufen`

| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| `stufe` | `INT PRIMARY KEY` | Kasernenstufe (1–4) |
| `money_cost` | `INT` | Ausbaukosten (Geld) |
| `stone_cost` | `INT` | Ausbaukosten (Stein) |
| `steel_cost` | `INT` | Ausbaukosten (Stahl) |
| `max_einheiten` | `INT` | Maximale Einheiten bei dieser Stufe |
