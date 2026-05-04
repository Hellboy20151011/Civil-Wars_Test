# Civil Wars – Test

Ein tick-basiertes Strategie-/Aufbau-Spiel mit Express, PostgreSQL, JWT-Authentifizierung, Zod-Validierung und Rate-Limiting.

---

## Voraussetzungen

| Tool | Mindestversion |
|------|---------------|
| Node.js | 18 |
| PostgreSQL | 14 |

---

## Lokales Setup

### 1. Repository klonen

```bash
git clone https://github.com/Hellboy20151011/Civil-Wars_Test.git
cd Civil-Wars_Test
```

---

## Quick Start mit Docker

```bash
cp backend/.env.example backend/.env  # .env anpassen (JWT_SECRET!)
docker compose up
```

Server läuft auf `http://localhost:3000`.

---

## Manuelles Setup

```bash
cd backend
npm install

cd ../frontend
npm install

cd ../backend
```

### 3. Umgebungsvariablen konfigurieren

```bash
cp .env.example .env
```

`.env` anpassen (Datenbankzugangsdaten, JWT-Secret):

```env
DB_USER=postgres
DB_HOST=localhost
DB_NAME=civil_wars_test
DB_PASSWORD=dein_passwort
DB_PORT=5432

PORT=3000

JWT_SECRET=langer_zufaelliger_geheimschluessel
JWT_EXPIRES_IN=7d
```

### 4. Datenbank initialisieren

Datenbank erstellen und Schema einspielen (setzt die DB zurück, falls sie bereits existiert):

```bash
# im backend/-Verzeichnis
node scripts/resetdb.js
```

Das Skript:

- legt die Datenbank `civil_wars_test` neu an
- spielt alle Schema-Dateien aus `database/schemas/` ein

---

## Server starten

```bash
# Produktion
npm start

# Entwicklung (Auto-Restart bei Dateiänderungen)
npm run dev

# Entwicklung Fullstack (Backend + Frontend Hot Reload)
npm run dev:full
```

Server läuft auf `http://localhost:3000`.

Bei `npm run dev:full` startet zusätzlich der Vite-Dev-Server mit HMR unter
`http://localhost:5173/pages/index.html`.

### Frontend-Build (Produktion)

```bash
cd frontend
npm run build
```

Der Build wird in `frontend/dist` geschrieben (minifiziert, gehashte Asset-Dateinamen, Tree-Shaking via Vite).
Beim Backend-Start wird automatisch `frontend/dist` ausgeliefert, falls vorhanden; sonst `frontend/`.

### Health Check

```bash
curl http://localhost:3000/health
# → { "status": "ok" }
```

---

## Tests

```bash
npm test
```

---

## Lint & Format

```bash
# Prüfen
npm run lint

# Automatisch formatieren
npm run format
```

---

## Projekt-Struktur

```text
backend/
  routes/         ← Express-Router (HTTP-Handler): auth, resources, buildings, me, units
  services/       ← Business-Logik: economy.service, units.service, gameloop-scheduler, gameloop
  middleware/     ← Auth, Validation, Rate-Limiting, Error Handling
  repositories/   ← Datenbankzugriff (SQL-Abfragen)
  database/       ← Schema-Dateien, Connection Pool
  scripts/        ← DB-Werkzeuge (resetdb.js)
  server.js       ← App-Einstiegspunkt
frontend/
  CSS/
  pages/
  scripts/
docs/             ← Architektur- und API-Dokumentation
API_DOCUMENTATION.md
VARIABLES.md
```

---

## Ressourcen-System

Das Spiel nutzt folgende Ressourcen:

| Feld | Einheit | Beschreibung |
|------|---------|-------------|
| `geld` | € | Finanzen |
| `stein` | t | Baurohstoff |
| `stahl` | t | Industrierohstoff |
| `treibstoff` | L | Energie für Einheiten |
| `strom` | MWh | Energiebilanz (Produktion − Verbrauch) |

---

## API

Vollständige API-Dokumentation: [API_DOCUMENTATION.md](API_DOCUMENTATION.md)

Basis-URL: `http://localhost:3000`

Alle geschützten Endpunkte erfordern einen `Authorization: Bearer <token>` Header.

---

## Weiterführende Dokumentation

- [API_DOCUMENTATION.md](API_DOCUMENTATION.md) – Endpunkte, Beispiele, Statuscodes
- [VARIABLES.md](VARIABLES.md) – Modulübersicht, Variablen, DB-Schema
- [CONTRIBUTING.md](CONTRIBUTING.md) – Branch-Konvention, Commit-Style, PR-Prozess
- [CHANGELOG.md](CHANGELOG.md) – Versionshistorie
- [docs/](docs/) – Architektur-Reviews, Bewertungen, Notizen

---

## Lizenz

Dieses Projekt steht unter der [MIT-Lizenz](LICENSE).
