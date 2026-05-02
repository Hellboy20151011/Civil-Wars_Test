# Gebäude

## Allgemeine Regeln

- **Strom-Abhängigkeit**: Alle Gebäude außer dem Kraftwerk benötigen Strom. Deine Strombilanz muss immer positiv sein, sonst funktioniert nichts.
- **Öl-Versorgung**: Eine Ölpumpe kann maximal 5 Öl-Raffinerien versorgen.
- **Treibstoff**: Wird später nur für Truppenbewegungen benötigt - aktuell nicht produktiv einsetzbar.

## Rathaus

- Beschreibung: Die Zentrale deiner Herrschaft. Ohne Rathaus kein Reich - es bildet die Grundlage für alle anderen Gebäude.
- Voraussetzungen:
  - keine
- Resourcen-Kosten:
  - Geld: 0€
  - Stein: 0t
  - Stahl: 0t
- Resourcen-Produktion:
  - Geld: 0€
  - Stein: 0t
  - Stahl: 0t
- Energie-Bilanz:
  - Strom-Verbrauch: 0Mwh
  - Strom-Produktion: 0Mwh

## Versorgungsgebäude

### Kraftwerk

- Beschreibung: Das Rückgrat deiner Infrastruktur. Ohne ausreichend Strom stillsteht deine Wirtschaft - jedes Kraftwerk produziert 50Mwh pro Tick.
- Voraussetzungen:
  - Rathaus
- Resourcen-Kosten:
  - Geld: 100.000€
  - Stein: 20t
  - Stahl: 15t
- Resourcen-Produktion:
  - Geld: 0€
  - Stein: 0t
  - Stahl: 0t
- Energie-Bilanz:
  - Strom-Verbrauch: 0Mwh
  - Strom-Produktion: 50Mwh
- Bauzeit: 1 Tick

### Steinbruch

- Beschreibung: Der Fundament deines Reiches - Stein ist überall nötig. Jeder Bruch produziert 10t pro Tick, kostet aber 10Mwh Strom.
- Voraussetzungen:
  - Rathaus
- Resourcen-Kosten:
  - Geld: 115.000€
  - Stein: 10t
  - Stahl: 15t
- Resourcen-Produktion:
  - Geld: 0€
  - Stein: 10t
  - Stahl: 0t
- Energie-Bilanz:
  - Strom-Verbrauch: 10Mwh
  - Strom-Produktion: 0Mwh

- Bauzeit: 0,5 Tick
- Beschreibung: Das Stahlwerk sichert deine Stahlversorgung. Jedes Stahlwerk hat eine Grundproduktion von 7t Stahl und einen Strombedarf von 15Mwh pro Tick.
- Voraussetzungen:
  - Rathaus
- Resourcen-Kosten:
  - Geld: 130.000€
  - Stein: 30t
  - Stahl: 20t
- Resourcen-Produktion:
  - Geld: 0€
  - Stein: 0t
  - Stahl: 7t
- Energie-Bilanz:
  - Strom-Verbrauch: 15Mwh
  - Strom-Produktion: 0Mwh

- Bauzeit: 1 Tick
- Beschreibung: Die Ölpumpe fördert Rohöl für deine Treibstoffproduktion. Jede Ölpumpe kann 5 Öl-Raffinerien versorgen. Die Ölpumpe hat einen Strombedarf von 5Mwh.
- Voraussetzungen:
  - Rathaus
- Resourcen-Kosten:
  - Geld: 150.000€
  - Stein: 10t
  - Stahl: 30t
- Resourcen-Produktion:
  - Geld: 0€
  - Stein: 0t
  - Stahl: 0t
- Energie-Bilanz:
  - Strom-Verbrauch: 5Mwh
  - Strom-Produktion: 0Mwh
- Bauzeit: 1,1 Ticks

### Öl-Raffinerie

- Beschreibung: Die Raffinerie wandelt das Rohöl in Treibstoff um, es können immer 5 Raffinerien von einer Ölpumpe versorgt werden. Eine Öl-Raffinerei hat eine Grundproduktion von 10L Treibstoff und einen Strombedarf von 15Mwh pro Tick.
- Voraussetzungen:
  - Rathaus
  - Ölpumpe (max. 5 Raffinerien pro Pumpe)
- Resourcen-Kosten:
  - Geld: 250.000€
  - Stein: 30t
  - Stahl: 45t
- Resourcen-Produktion:
  - Geld: 0€
  - Stein: 0t
  - Stahl: 0t
  - Treibstoff: 10L
- Energie-Bilanz:
  - Strom-Verbrauch: 15Mwh
  - Strom-Produktion: 0Mwh

- Bauzeit: 2 Ticks

## Unterkünfte

### Wohnhaus

- Beschreibung: Das Wohnhaus ist das Grundgebäude für die Geldproduktion. Es beherbergt 4 Personen und hat eine Grundmiete von 5.000€ es hat einen Strombedarf von 5Mwh.
- Voraussetzungen:
  - Rathaus
- Resourcen-Kosten:
  - Geld: 80.000€
  - Stein: 5t
  - Stahl: 7t
- Resourcen-Produktion:
  - Geld: 5.000€
  - Stein: 0t
  - Stahl: 0t
- Energie-Bilanz:
  - Strom-Verbrauch: 5Mwh
  - Strom-Produktion: 0Mwh
- Bevölkerung:
  - Einwohner: 4 Personen
- Bauzeit: 0,5 Tick

### Reihenhaus

- Beschreibung: Das Reihenhaus ist die gehobene Variante der Wohnmöglichkeiten. Es beherbergt 9 Personen und hat eine Grundmiete von 8.000€ es hat einen Strombedarf von 8Mwh.
- Voraussetzungen:
  - Rathaus
- Resourcen-Kosten:
  - Geld: 120.000€
  - Stein: 12t
  - Stahl: 18t
- Resourcen-Produktion:
  - Geld: 8.000€
  - Stein: 0t
  - Stahl: 0t
- Energie-Bilanz:
  - Strom-Verbrauch: 8Mwh
  - Strom-Produktion: 0Mwh
- Bevölkerung:
  - Einwohner: 9 Personen
- Bauzeit: 1 Tick

### Mehrfamilienhaus

- Beschreibung: Das Mehrfamilienhaus erhöht die Einwohnerzahl noch weiter. Es beherbergt 16 Personen und hat eine Grundmiete von 12.000€ es hat einen Strombedarf von 11Mwh.
- Voraussetzungen:
  - Rathaus
- Resourcen-Kosten:
  - Geld: 165.000€
  - Stein: 15t
  - Stahl: 24t
- Resourcen-Produktion:
  - Geld: 12.000€
  - Stein: 0t
  - Stahl: 0t
- Energie-Bilanz:
  - Strom-Verbrauch: 11Mwh
  - Strom-Produktion: 0Mwh
- Bevölkerung:
  - Einwohner: 16 Personen
- Bauzeit: 1,5 Ticks

### Hochhaus

- Beschreibung: Das Hochhaus ist das größte Wohngebäude der Basis. Es beherbergt 50 Personen und hat eine Grundmiete von 18.000€ es hat einen Strombedarf von 20Mwh.
- Voraussetzungen:
  - Rathaus
- Resourcen-Kosten:
  - Geld: 225.000€
  - Stein: 20t
  - Stahl: 40t
- Resourcen-Produktion:
  - Geld: 18.000€
  - Stein: 0t
  - Stahl: 0t
- Energie-Bilanz:
  - Strom-Verbrauch: 20Mwh
  - Strom-Produktion: 0Mwh
- Bevölkerung:
  - Einwohner: 50 Personen
- Bauzeit: 2 Ticks

## Militär

### Kaserne

Die Kaserne kann auf 4 Level aufgerüstet werden um unterschiedliche Einheitentypen freizuschalten.

#### K.Level 1

- Beschreibung: Grundstufe der Kaserne
- Einheit: Soldat
- Voraussetzungen:
  - Rathaus
- Resourcen-Kosten:
  - Geld: 150.000€
  - Stein: 40t
  - Stahl: 50t
- Bauzeit: 1,5 Ticks

#### K.Level 2

- Beschreibung: Erste Erweiterungsstufe
- Einheit: Pionier
- Voraussetzungen:
  - Kaserne Level 1
- Resourcen-Kosten:
  - Geld: 500.000€
  - Stein: 100t
  - Stahl: 120t
- Bauzeit: 3 Ticks

#### K.Level 3

- Beschreibung: Zweite Ausbaustufe
- Einheit: Minentaucher
- Voraussetzungen:
  - Kaserne Level 2
- Resourcen-Kosten:
  - Geld: 1.000.000€
  - Stein: 300t
  - Stahl: 500t
- Bauzeit: 6 Ticks

#### K.Level 4

- Beschreibung: Letzte Ausbaustufe
- Einheit: Seal
- Voraussetzungen:
  - Kaserne Level 3
- Resourcen-Kosten:
  - Geld: 2.500.000€
  - Stein: 1000t
  - Stahl: 2500t
- Bauzeit: 12 Ticks

### Fahrzeugfabrik

Die Fahrzeugfabrik kann auf 4 Level aufgerüstet werden um unterschiedliche Einheitentypen freizuschalten.

#### F.Level 1

- Beschreibung: Basisstufe der Fahrzeugfabrik
- Einheit:Jeep
- Voraussetzungen:
  - Rathaus
- Resourcen-Kosten:
  - Geld: 250.000€
  - Stein: 75t
  - Stahl: 90t
- Bauzeit: 1,5 Ticks

#### F.Level 2

- Beschreibung: Zweite Entwicklungsstufe
- Einheit:Minenleger
- Voraussetzungen:
  - Fahrzeugfabrik Level 1
- Resourcen-Kosten:
  - Geld: 500.000€
  - Stein: 185t
  - Stahl: 235t
- Bauzeit: 4,5 Ticks

#### F.Level 3

- Beschreibung: Dritte Aufwertungsstufe
- Einheit: Kampfpanzer
- Voraussetzungen:
  - Fahrzeugfabrik Level 2
- Resourcen-Kosten:
  - Geld: 1.500.000€
  - Stein: 465t
  - Stahl: 675t
- Bauzeit: 9 Ticks

#### F.Level 4

- Beschreibung: Stufe 4 der Fahrzeugentwicklung
- Einheit: Panzerhaubitze
- Voraussetzungen:
  - Fahrzeugfabrik Level 3
- Resourcen-Kosten:
  - Geld: 3.000.000€
  - Stein: 1150t
  - Stahl: 3200t
- Bauzeit: 12 Ticks

### Schiffswerft

Die Schiffswerft kann auf 4 Level aufgerüstet werden um unterschiedliche Einheitentypen freizuschalten.

#### W.Level 1

- Beschreibung: Basisstufe der Schiffswerft
- Einheit: Torpedoboot
- Voraussetzungen:
  - Rathaus
- Resourcen-Kosten:
  - Geld: 280.000€
  - Stein: 85t
  - Stahl: 105t
- Bauzeit: 2 Ticks

#### W.Level 2

- Beschreibung: Erste Entwicklungsstufe
- Einheit: Fregatte
- Voraussetzungen:
  - Schiffswerft Level 1
- Resourcen-Kosten:
  - Geld: 600.000€
  - Stein: 210t
  - Stahl: 280t
- Bauzeit: 6 Ticks

#### W.Level 3

- Beschreibung: Zweite Ausbaustufe
- Einheit: U-Boot
- Voraussetzungen:
  - Schiffswerft Level 2
- Resourcen-Kosten:
  - Geld: 1.800.000€
  - Stein: 540t
  - Stahl: 810t
- Bauzeit: 12 Ticks

#### W.Level 4

- Beschreibung: Höchste Ausbaustufe
- Einheit: Flugzeugträger
- Voraussetzungen:
  - Schiffswerft Level 3
- Resourcen-Kosten:
  - Geld: 3.500.000€
  - Stein: 1300t
  - Stahl: 3500t
- Bauzeit: 18 Ticks

### Flugplatz

Der Flugplatz kann auf 4 Level aufgerüstet werden um unterschiedliche Einheitentypen freizuschalten.

#### A.Level 1

- Beschreibung: Basisstufe des Flugplatzes
- Einheit: Kampfhubschrauber
- Voraussetzungen:
  - Rathaus
- Resourcen-Kosten:
  - Geld: 300.000€
  - Stein: 95t
  - Stahl: 120t
- Bauzeit: 2,5 Ticks

#### A.Level 2

- Beschreibung: Erste Entwicklungsstufe
- Einheit: Kampfjet
- Voraussetzungen:
  - Flugplatz Level 1
- Resourcen-Kosten:
  - Geld: 700.000€
  - Stein: 245t
  - Stahl: 350t
- Bauzeit: 7,5 Ticks

#### A.Level 3

- Beschreibung: Zweite Ausbaustufe
- Einheit: Bomber
- Voraussetzungen:
  - Flugplatz Level 2
- Resourcen-Kosten:
  - Geld: 2.000.000€
  - Stein: 650t
  - Stahl: 950t
- Bauzeit: 15 Ticks

#### A.Level 4

- Beschreibung: Höchste Ausbaustufe
- Einheit: Transportflugzeug
- Voraussetzungen:
  - Flugplatz Level 3
- Resourcen-Kosten:
  - Geld: 4.000.000€
  - Stein: 1500t
  - Stahl: 4000t
- Bauzeit: 20 Ticks

## Regierungsgebäude

### Geheimdienstzentrum

Das Geheimdienstzentrum ermöglicht die Spionage anderer Spieler und kann auf 3 Stufen ausgebaut werden.

#### G.Stufe 1

- Beschreibung: Basisstufe des Geheimdienstzentrums
- Spionagemittel: Spion
- Voraussetzungen:
  - Rathaus
- Resourcen-Kosten:
  - Geld: 140.000€
  - Stein: 45t
  - Stahl: 65t
- Bauzeit: 1 Tick

#### G.Stufe 2

- Beschreibung: Erste Erweiterungsstufe
- Spionagemittel: SR-71 Blackbird
- Voraussetzungen:
  - Geheimdienstzentrum Stufe 1
- Resourcen-Kosten:
  - Geld: 420.000€
  - Stein: 160t
  - Stahl: 260t
- Bauzeit: 3 Ticks

#### G.Stufe 3

- Beschreibung: Höchste Ausbaustufe
- Spionagemittel: Spionagesatellit
- Voraussetzungen:
  - Geheimdienstzentrum Stufe 2
- Resourcen-Kosten:
  - Geld: 1.100.000€
  - Stein: 500t
  - Stahl: 900t
- Bauzeit: 9 Ticks

### Forschungslabor

Das Forschungslabor verbessert deine Technologien und kann auf 3 Stufen ausgebaut werden.

#### F.Labor Stufe 1

- Beschreibung: Basisstufe des Forschungslabors
- Fokus: Grundlagentechnik
- Voraussetzungen:
  - Rathaus
- Resourcen-Kosten:
  - Geld: 200.000€
  - Stein: 60t
  - Stahl: 80t
- Bauzeit: 2 Ticks

#### F.Labor Stufe 2

- Beschreibung: Erste Erweiterungsstufe
- Fokus: Fortgeschrittene Technologie
- Voraussetzungen:
  - Forschungslabor Stufe 1
- Resourcen-Kosten:
  - Geld: 600.000€
  - Stein: 200t
  - Stahl: 300t
- Bauzeit: 6 Ticks

#### F.Labor Stufe 3

- Beschreibung: Höchste Ausbaustufe
- Fokus: Militärische Spitzentechnologie
- Voraussetzungen:
  - Forschungslabor Stufe 2
- Resourcen-Kosten:
  - Geld: 1.500.000€
  - Stein: 600t
  - Stahl: 1000t
- Bauzeit: 12 Ticks

### Bank

Die Bank ermöglicht Zinsen auf das eigene Depot und kann auf 3 Stufen ausgebaut werden.

#### B.Stufe 1

- Beschreibung: Basisstufe der Bank
- Funktion: 1% Zinsen auf Depot
- Voraussetzungen:
  - Rathaus
- Resourcen-Kosten:
  - Geld: 120.000€
  - Stein: 25t
  - Stahl: 40t
- Bauzeit: 1 Tick

#### B.Stufe 2

- Beschreibung: Erste Erweiterungsstufe
- Funktion: 2% Zinsen auf Depot
- Voraussetzungen:
  - Bank Stufe 1
- Resourcen-Kosten:
  - Geld: 350.000€
  - Stein: 100t
  - Stahl: 150t
- Bauzeit: 2,5 Ticks

#### B.Stufe 3

- Beschreibung: Höchste Ausbaustufe
- Funktion: 5% Zinsen auf Depot
- Voraussetzungen:
  - Bank Stufe 2
- Resourcen-Kosten:
  - Geld: 800.000€
  - Stein: 300t
  - Stahl: 500t
- Bauzeit: 6 Ticks

## Verteidigun

### Gegenspionage

Die Gegenspionage schützt vor feindlicher Spionage und kann auf 3 Stufen ausgebaut werden.

#### GS.Stufe 1

- Beschreibung: Basisstufe der Gegenspionage
- Abwehrmittel: Stacheldraht
- Voraussetzungen:
  - Rathaus
- Resourcen-Kosten:
  - Geld: 100.000€
  - Stein: 30t
  - Stahl: 50t
- Bauzeit: 0,5 Tick

#### GS.Stufe 2

- Beschreibung: Erste Erweiterungsstufe
- Abwehrmittel: Abfangjäger
- Voraussetzungen:
  - Gegenspionage Stufe 1
- Resourcen-Kosten:
  - Geld: 350.000€
  - Stein: 120t
  - Stahl: 200t
- Bauzeit: 2 Ticks

#### GS.Stufe 3

- Beschreibung: Höchste Ausbaustufe
- Abwehrmittel: Spionagesatellit
- Voraussetzungen:
  - Gegenspionage Stufe 2
- Resourcen-Kosten:
  - Geld: 900.000€
  - Stein: 400t
  - Stahl: 700t
- Bauzeit: 6 Ticks

### Landverteidigung

Die Landverteidigung sichert die Basis gegen Bodenangriffe und kann auf 3 Stufen ausgebaut werden.

#### LV.Stufe 1

- Beschreibung: Basisstufe der Landverteidigung
- Verteidigungsmittel: MG-Nest
- Voraussetzungen:
  - Rathaus
- Resourcen-Kosten:
  - Geld: 80.000€
  - Stein: 25t
  - Stahl: 35t
- Bauzeit: 0,5 Tick

#### LV.Stufe 2

- Beschreibung: Erste Erweiterungsstufe
- Verteidigungsmittel: Minen
- Voraussetzungen:
  - Landverteidigung Stufe 1
- Resourcen-Kosten:
  - Geld: 250.000€
  - Stein: 100t
  - Stahl: 150t
- Bauzeit: 1,5 Ticks

#### LV.Stufe 3

- Beschreibung: Höchste Ausbaustufe
- Verteidigungsmittel: Geschützturm
- Voraussetzungen:
  - Landverteidigung Stufe 2
- Resourcen-Kosten:
  - Geld: 700.000€
  - Stein: 350t
  - Stahl: 600t
- Bauzeit: 5 Ticks

### Seeverteidigung

Die Seeverteidigung sichert die Basis gegen Angriffe vom Wasser und kann auf 3 Stufen ausgebaut werden.

#### SV.Stufe 1

- Beschreibung: Basisstufe der Seeverteidigung
- Verteidigungsmittel: Torpedoboote
- Voraussetzungen:
  - Rathaus
- Resourcen-Kosten:
  - Geld: 150.000€
  - Stein: 50t
  - Stahl: 80t
- Bauzeit: 1 Tick

#### SV.Stufe 2

- Beschreibung: Erste Erweiterungsstufe
- Verteidigungsmittel: Unterwasserminen
- Voraussetzungen:
  - Seeverteidigung Stufe 1
- Resourcen-Kosten:
  - Geld: 400.000€
  - Stein: 150t
  - Stahl: 250t
- Bauzeit: 3 Ticks

#### SV.Stufe 3

- Beschreibung: Höchste Ausbaustufe
- Verteidigungsmittel: Küstenbatterie
- Voraussetzungen:
  - Seeverteidigung Stufe 2
- Resourcen-Kosten:
  - Geld: 1.000.000€
  - Stein: 450t
  - Stahl: 800t
- Bauzeit: 7 Ticks

### Luftverteidigung

Die Luftverteidigung sichert die Basis gegen Luftangriffe und kann auf 3 Stufen ausgebaut werden.

#### AV.Stufe 1

- Beschreibung: Basisstufe der Luftverteidigung
- Verteidigungsmittel: Flugabwehrkanone
- Voraussetzungen:
  - Rathaus
- Resourcen-Kosten:
  - Geld: 120.000€
  - Stein: 40t
  - Stahl: 60t
- Bauzeit: 1 Tick

#### AV.Stufe 2

- Beschreibung: Erste Erweiterungsstufe
- Verteidigungsmittel: RAM-Missile
- Voraussetzungen:
  - Luftverteidigung Stufe 1
- Resourcen-Kosten:
  - Geld: 350.000€
  - Stein: 130t
  - Stahl: 220t
- Bauzeit: 2,5 Ticks

#### AV.Stufe 3

- Beschreibung: Höchste Ausbaustufe
- Verteidigungsmittel: SM-1 Missile
- Voraussetzungen:
  - Luftverteidigung Stufe 2
- Resourcen-Kosten:
  - Geld: 950.000€
  - Stein: 420t
  - Stahl: 750t
- Bauzeit: 7,5 Ticks

## DB-Schema

- ID
- Name
- Voraussetzung
- Resourcen-Kosten
  - Geld
  - Stein
  - Stahl
- Resourcen-Produktion
  - Geld
  - Stein
  - Stahl
  - Treibstoff
- Strom-Verbrauch
- Strom-Produktion
- Bevölkerung
- Stufe
- Bauzeit
- Beschreibung
