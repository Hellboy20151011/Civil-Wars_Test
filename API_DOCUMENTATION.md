# Civil Wars - API Dokumentation

## 🎮 Server & Game Loop

### Server-Start
```bash
npm run dev              # Development (Ticks alle 1 Min)
npm run start            # Production (Ticks alle 10 Min)
```

### Game Loop
- **Tick-Intervall (Dev):** 1 Minute = 10 Minuten Spielzeit
- **Tick-Intervall (Prod):** 10 Minuten = 1 Tick Spielzeit
- **Automatische Prozesse pro Tick:**
  - ✅ Ressourcenproduktion von fertigen Gebäuden
  - ✅ Gebäudefertigstellung (is_constructing → FALSE)
  - ✅ Einheiten-Ankünfte am Zielort

---

## 🏗️ Buildings API

### GET `/buildings/types`
Alle verfügbaren Gebäudetypen abrufen
```json
Response:
[
  {
    "id": 1,
    "name": "Rathaus",
    "category": "infrastructure",
    "level": 1,
    "money_cost": 100,
    "stone_cost": 50,
    "steel_cost": 20,
    "fuel_cost": 0,
    "build_time_ticks": 5,
    "money_production": 1000,
    "power_consumption": 50
  }
]
```

### GET `/buildings/me`
Spieler-Gebäude + Bauwarteschlange
```json
Response:
{
  "buildings": [...],
  "queue": [...]
}
```

### POST `/buildings/build`
Neues Gebäude bauen
```json
Request:
{
  "building_type_id": 1,
  "anzahl": 1
}

Response:
{
  "message": "Kraftwerk wird gebaut (fertig um 20:25).",
  "auftrag": {
    "id": 123,
    "user_id": 1,
    "building_type_id": 7,
    "erstellt_am": "2026-05-07T20:23:00.000Z",
    "fertig_am": "2026-05-07T20:25:00.000Z",
    "anzahl": 1
  }
}
```

Hinweis: Es gibt derzeit keinen Endpoint `POST /buildings/:id/upgrade`.

### POST `/me/stream-ticket`
Fordert ein kurzlebiges Einmal-Ticket fuer den SSE-Stream an.
```json
Response:
{
  "ticket": "once_token_for_sse"
}
```

### GET `/me/stream?ticket=...`
Oeffnet den Server-Sent-Events-Stream fuer Live-Statusupdates.

- Authentifizierung erfolgt ueber das zuvor angeforderte Ticket, nicht ueber einen JWT in der URL.
- Das Ticket ist nur kurz gueltig und kann nur einmal eingeloest werden.

---

## 🪖 Units API

### GET `/units/types`
Alle verfügbaren Einheitentypen abrufen
```json
Response:
[
  {
    "id": 1,
    "name": "Soldat",
    "category": "Infantry",
    "building_requirement": "Kaserne",
    "money_cost": 100,
    "steel_cost": 0,
    "fuel_cost": 0,
    "training_time_ticks": 2,
    "hitpoints": 20,
    "attack_points": 5,
    "defense_points": 2,
    "movement_speed": 5,
    "special_ability": null
  }
]
```

### GET `/units/types/category/:category`
Einheiten nach Kategorie filtern (Infantry, Vehicle, Ship, Air, Spionage, Defense)

### GET `/units/me`
Alle Einheiten des Spielers abrufen
```json
Response:
[
  {
    "id": 1,
    "quantity": 50,
    "health_percentage": 100,
    "experience_points": 0,
    "location_x": 0,
    "location_y": 0,
    "is_moving": false,
    "destination_x": null,
    "destination_y": null,
    "arrival_time": null,
    "name": "Soldat",
    "category": "Infantry"
  }
]
```

### POST `/units/train`
Einheiten ausbilden
```json
Request:
{
  "unit_type_id": 1,
  "quantity": 10
}

Response:
{
  "success": true,
  "message": "10x Soldat wird ausgebildet",
  "data": {
    "unit": "Soldat",
    "quantity": 10,
    "totalCost": {
      "money": 1000,
      "steel": 0,
      "fuel": 0
    },
    "trainingTime": 20
  }
}
```

### POST `/units/move`
Einheiten bewegen
```json
Request:
{
  "user_unit_id": 1,
  "destination_x": 100,
  "destination_y": 50
}

Response:
{
  "success": true,
  "message": "Einheit bewegt sich zum Ziel (100, 50)",
  "data": {
    "distance": 111.8,
    "travelTime": 22.36,
    "arrivalTime": "2026-05-02T10:20:30.000Z"
  }
}
```

### POST `/units/attack`
Angriff mit Einheiten
```json
Request:
{
  "attacking_unit_id": 1,
  "target_unit_id": 2
}

Response:
{
  "success": true,
  "message": "Angriff erfolgreich! 8.50 Schaden verursacht",
  "data": {
    "baseDamage": 13,
    "actualDamage": 8.5,
    "targetHealth": 85.5,
    "targetDestroyed": false
  }
}
```

---

## 💰 Resources API

### GET `/resources/me`
Alle Ressourcen des Spielers
```json
Response:
{
  "resources": {
    "geld": 50000,
    "stein": 1200,
    "stahl": 800,
    "treibstoff": 350,
    "strom": 40
  }
}
```

---

## 👤 Me API

### GET `/me`
Aktuelle Spieler-Informationen
```json
Response:
{
  "id": 1,
  "username": "Player1",
  "email": "player@example.com",
  "created_at": "2026-05-01T12:00:00.000Z"
}
```

---

## 🔐 Auth API

### POST `/auth/register`
Neuen Account erstellen
```json
Request:
{
  "username": "Player1",
  "email": "player@example.com",
  "password": "SecurePassword123"
}

Response:
{
  "success": true,
  "message": "Registrierung erfolgreich",
  "token": "eyJhbGc...",
  "refresh_token": "long_random_refresh_token"
}
```

### POST `/auth/login`
Mit Account anmelden
```json
Request:
{
  "username": "Player1",
  "password": "SecurePassword123"
}

Response:
{
  "success": true,
  "token": "eyJhbGc...",
  "refresh_token": "long_random_refresh_token"
}
```

### POST `/auth/refresh`
Access-Token mit Refresh-Token erneuern (Token-Rotation)
```json
Request:
{
  "refresh_token": "long_random_refresh_token"
}

Response:
{
  "message": "Token refreshed successfully",
  "token": "eyJhbGc...",
  "refresh_token": "new_long_random_refresh_token"
}
```

---

## 📊 Game Balance

### Ressourcenproduktion (pro Tick)
| Gebäude | Typ | Produktion |
|---------|-----|-----------|
| Rathaus | Geld | 1.000€ |
| Steinbruch | Stein | 500t |
| Stahlwerk | Stahl | 200t |
| Ölpumpe | Treibstoff | 100L |
| Kraftwerk | Strom | 500 Mwh |

### Einheitenkosten
| Einheit | Geld | Stahl | Fuel | Trainingszeit |
|---------|------|--------|------|--------------|
| Soldat | 100€ | 0t | 0L | 2 Ticks |
| Jeep | 500€ | 50t | 10L | 3 Ticks |
| Kampfhubschrauber | 1000€ | 100t | 50L | 4 Ticks |

### Schaden-Berechnung
```
Echter Schaden = Angriff - (Verteidigung × 0.5)
```

---

## ✅ Status Codes

| Code | Bedeutung |
|------|-----------|
| 200 | ✅ Erfolgreich |
| 400 | ❌ Fehler in Request (Ressourcen, Validierung) |
| 401 | 🔒 Authentifizierung erforderlich |
| 404 | 🚫 Nicht gefunden |
| 429 | ⏱️ Rate Limit überschritten |
| 500 | 💥 Server-Fehler |

---

## 🔗 Headers

Alle Requests außer `/auth/register` und `/auth/login` benötigen:
```
Authorization: Bearer <token>
Content-Type: application/json
```

---

## 📝 Notizen

- Alle Zeitangaben sind in **Ticks** (nicht Millisekunden)
- 1 Tick Dev = 1 Minute echte Zeit
- 1 Tick Prod = 10 Minuten echte Zeit
- Coordinates sind kartesisch (X, Y) mit Ursprung (0, 0) im Zentrum
- Distanz = √((x₂-x₁)² + (y₂-y₁)²)
- Alle Kosten werden sofort abgezogen, nicht über Zeit
- Vollständige, maschinenlesbare API-Definition: `docs/openapi.yaml` (inkl. produktiver Router `map`, `research`, `combat`, `espionage`).
