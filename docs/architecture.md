# Architektur - Civil Wars

## Ueberblick

Das Backend folgt einer klaren Schichtenarchitektur mit Trennung von HTTP, Business-Logik und Datenzugriff.

```text
Client (Frontend / API-Client)
    -> routes/
    -> services/
    -> repositories/
    -> database/db.js (pg Pool)
    -> PostgreSQL
```

## Schichten

### 1. routes/
- Verantwortung: HTTP-Handling, Request-Validierung, Auth, Response-Mapping.
- Keine Business-Logik oder SQL.
- Relevante Dateien:
  - backend/routes/auth.js
  - backend/routes/me.js
  - backend/routes/resources.js
  - backend/routes/buildings.js
  - backend/routes/units.js

### 2. services/
- Verantwortung: Business-Regeln, Tick-Logik, fachliche Berechnungen.
- Greifen nicht direkt auf `database/db.js` zu, sondern nutzen Repositories.
- Relevante Dateien:
  - backend/services/economy.service.js
  - backend/services/buildings.service.js
  - backend/services/units.service.js
  - backend/services/gameloop.js
  - backend/services/gameloop-scheduler.js
  - backend/services/live-updates.service.js

### 3. repositories/
- Verantwortung: Alle DB-Zugriffe und SQL-Statements.
- SQL ausschliesslich als parametrierte Queries (`$1`, `$2`, ...) mit separatem Parameter-Array.
- Relevante Dateien:
  - backend/repositories/player.repository.js
  - backend/repositories/resources.repository.js
  - backend/repositories/building.repository.js
  - backend/repositories/units.repository.js
  - backend/repositories/reference-data.repository.js
  - backend/repositories/transaction.repository.js

### 4. database/
- Verantwortung: DB-Verbindungspool.
- Datei: `backend/database/db.js`

## Laufzeitfluss

### Authentifizierter API-Request
1. Route validiert Request (Zod) und Auth (`requireAuth`).
2. Route startet ggf. Transaktion.
3. Service fuehrt Business-Logik aus.
4. Repository liest/schreibt Daten in PostgreSQL.
5. Route liefert Response.

### Tick-System
1. `gameloop-scheduler.js` triggert periodisch Ticks.
2. Pro aktivem User werden Produktions-Ticks und Bauqueue verarbeitet.
3. Aktueller Status wird via SSE (live-updates.service.js) an verbundene Clients gesendet.

## Querschnitt

### Konfiguration
- Zentrale Konfiguration in `backend/config.js`.
- Keine direkten `process.env`-Zugriffe ausserhalb dieser Datei.

### Fehlerbehandlung
- Routen nutzen `asyncWrapper`.
- Zentrale Fehlerausgabe ueber `middleware/errorHandler.js`.

### Sicherheit
- JWT-basierte Authentifizierung.
- CORS ueber konfigurierbare Origins.
- Rate-Limits fuer Auth- und API-Routen.
- Parametrierte SQL-Queries als Pflicht.

## Frontend-Anbindung
- Frontend wird statisch ueber Express ausgeliefert (`frontend/dist` bevorzugt, sonst `frontend/`).
- API-Basis im Frontend zentral in `frontend/scripts/config.js`.
- Live-Updates per SSE ueber `GET /me/stream`.
