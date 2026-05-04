# Kampfsystem

## Ablauf

1. Spieler wählt auf der Karte einen Gegner und entsendet Einheiten.
2. Einheiten reisen zur Zielkoordinate – Reisezeit abhängig von Distanz und der **langsamsten Einheit** im Verband.
3. Kampfberechnung (siehe unten) wird beim Ankommen im Tick ausgeführt.
4. Überlebende Einheiten treten die Rückreise an.

### Ergebnisse

- **Angreifer gewinnt** → erhält einen Teil der Industrie- und Unterkunftsgebäude des Gegners.
- **Angreifer verliert** → der Verteidiger erhält einen Teil der Ressourcen, die die vernichteten Einheiten gekostet haben (Schrottfeld).

---

## Kampfregeln

### Hartes Matchup-System

Nicht jede Einheit kann gegen jeden kämpfen. Ein Soldat kann keinen Hubschrauber angreifen.  
Der **Kategorie** der Einheit entscheidet, wen sie angreifen kann – und mit welchem Effektivitätsmultiplikator.

| Angreifer-Kategorie | Ziel-Kategorie | Multiplikator |
|---|---|---|
| Infanterie | Infanterie | 1,0× |
| Infanterie | Fahrzeug | 0,5× |
| Infanterie | Verteidigung | 0,6× |
| Fahrzeug | Infanterie | 1,2× |
| Fahrzeug | Fahrzeug | 1,0× |
| Fahrzeug | Verteidigung | 0,9× |
| Schiff | Infanterie | 0,8× |
| Schiff | Schiff | 1,0× |
| Schiff | Verteidigung | 1,0× |
| Luft | Infanterie | 1,5× |
| Luft | Fahrzeug | 1,2× |
| Luft | Schiff | 1,0× |
| Luft | Luft | 1,0× |
| Luft | Verteidigung | 1,0× |
| Verteidigung | – | passiv (greift nie an) |

> Einheiten die nicht getroffen werden können (z.B. Hubschrauber gegen reine Infanterie) erleiden **keine Verluste**.

### Sonderregeln

| Einheit | Sonderregel |
|---|---|
| **Pionier** | Angriff gegen Fahrzeuge mit 0,8× statt 0,5× |
| **Minentaucher** | Angriff gegen Fahrzeuge mit 0,8× statt 0,5×; neutralisiert **vor dem Kampf** alle Verteidigungseinheiten des Gegners (Küstenverteidigung / Minenfelder) |
| **Fregatte** | Kann zusätzlich Lufteinheiten angreifen (0,8×) |

### Counter-Unit-Bonus

Jede Einheit hat eine definierte Konter-Einheit. Kämpft eine Einheit gegen ihre Konter-Einheit, erhält sie **+30 % Angriffsschaden**.

---

## Einheiten-Matchup-Tabelle

`✓` = kann angreifen · `✗` = kein Angriff möglich · Zahl = Effektivitätsmultiplikator · `S` = Sonderregel (siehe unten)

> **Spionage-Einheiten** nehmen am direkten Kampf nicht teil (gesonderte Regeln geplant).

### Legende Sonderregeln

- `S1` = Pionier/Minentaucher: 0,8× gegen Fahrzeuge (statt 0,5×)
- `S2` = Minentaucher: neutralisiert Verteidigung vor dem Kampf (gilt als ✓ 0,8×)
- `S3` = Fregatte: greift Luft an (0,8×)

### Tabelle

|  | **Soldat** | **Pionier** | **Minentaucher** | **Seal** | **Jeep** | **Minenleger** | **Kampfpanzer** | **Panzerhaubitze** | **Torpedoboot** | **Fregatte** | **U-Boot** | **Flugzeugträger** | **Kampfhubschrauber** | **Kampfjet** | **Bomber** | **Transportflugzeug** |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Soldat** *(inf)* | 1,0 | 1,0 | 1,0 | 1,0 | 0,5 | 0,5 | 0,5 | 0,5 | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| **Pionier** *(inf)* | 1,0 | 1,0 | 1,0 | 1,0 | S1 0,8 | S1 0,8 | S1 0,8 | S1 0,8 | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| **Minentaucher** *(inf)* | 1,0 | 1,0 | 1,0 | 1,0 | S1 0,8 | S1 0,8 | S1 0,8 | S1 0,8 | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| **Seal** *(inf)* | 1,0 | 1,0 | 1,0 | 1,0 | 0,5 | 0,5 | 0,5 | 0,5 | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| **Jeep** *(veh)* | 1,2 | 1,2 | 1,2 | 1,2 | 1,0 | 1,0 | 1,0 | 1,0 | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| **Minenleger** *(veh)* | 1,2 | 1,2 | 1,2 | 1,2 | 1,0 | 1,0 | 1,0 | 1,0 | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| **Kampfpanzer** *(veh)* | 1,2 | 1,2 | 1,2 | 1,2 | 1,0 | 1,0 | 1,0 | 1,0 | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| **Panzerhaubitze** *(veh)* | 1,2 | 1,2 | 1,2 | 1,2 | 1,0 | 1,0 | 1,0 | 1,0 | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| **Torpedoboot** *(ship)* | 0,8 | 0,8 | 0,8 | 0,8 | ✗ | ✗ | ✗ | ✗ | 1,0 | 1,0 | 1,0 | 1,0 | ✗ | ✗ | ✗ | ✗ |
| **Fregatte** *(ship)* | 0,8 | 0,8 | 0,8 | 0,8 | ✗ | ✗ | ✗ | ✗ | 1,0 | 1,0 | 1,0 | 1,0 | S3 0,8 | S3 0,8 | S3 0,8 | S3 0,8 |
| **U-Boot** *(ship)* | 0,8 | 0,8 | 0,8 | 0,8 | ✗ | ✗ | ✗ | ✗ | 1,0 | 1,0 | 1,0 | 1,0 | ✗ | ✗ | ✗ | ✗ |
| **Flugzeugträger** *(ship)* | 0,8 | 0,8 | 0,8 | 0,8 | ✗ | ✗ | ✗ | ✗ | 1,0 | 1,0 | 1,0 | 1,0 | ✗ | ✗ | ✗ | ✗ |
| **Kampfhubschrauber** *(air)* | 1,5 | 1,5 | 1,5 | 1,5 | 1,2 | 1,2 | 1,2 | 1,2 | 1,0 | 1,0 | 1,0 | 1,0 | 1,0 | 1,0 | 1,0 | 1,0 |
| **Kampfjet** *(air)* | 1,5 | 1,5 | 1,5 | 1,5 | 1,2 | 1,2 | 1,2 | 1,2 | 1,0 | 1,0 | 1,0 | 1,0 | 1,0 | 1,0 | 1,0 | 1,0 |
| **Bomber** *(air)* | 1,5 | 1,5 | 1,5 | 1,5 | 1,2 | 1,2 | 1,2 | 1,2 | 1,0 | 1,0 | 1,0 | 1,0 | 1,0 | 1,0 | 1,0 | 1,0 |
| **Transportflugzeug** *(air)* | 1,5 | 1,5 | 1,5 | 1,5 | 1,2 | 1,2 | 1,2 | 1,2 | 1,0 | 1,0 | 1,0 | 1,0 | 1,0 | 1,0 | 1,0 | 1,0 |

> Verteidigungseinheiten (Bunker, Küstenbatterien etc.) sind **passiv** – sie tauchen nur als Ziel-Spalten auf, nicht als Angreifer-Zeilen.  
> Spionage-Einheiten erscheinen in der Tabelle nicht – ihr Kampfsystem wird separat definiert.
