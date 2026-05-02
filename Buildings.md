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
  - Stein: 20t
  - Stahl: 0t
- Energie-Bilanz:
  - Strom-Verbrauch: 10Mwh
  - Strom-Produktion: 0Mwh

### Stahlwerk

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

### Ölpumpe

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

## Militär

### Kaserne

Die Kaserne kann auf 4 Level aufgerüstet werden um unterschiedliche Einheitentypen freizuschalten.

#### Level 1

- Beschreibung:
- Einheit:
- Voraussetzungen:
  - Rathaus
- Resourcen-Kosten:
  - Geld: €
  - Stein: t
  - Stahl: t

#### Level 2

- Beschreibung:
- Einheit:
- Voraussetzungen:
  - Kaserne Level 1
- Resourcen-Kosten:
  - Geld: €
  - Stein: t
  - Stahl: t

#### Level 3

- Beschreibung:
- Einheit:
- Voraussetzungen:
  - Kaserne Level 2
- Resourcen-Kosten:
  - Geld: €
  - Stein: t
  - Stahl: t

#### Level 4

- Beschreibung:
- Einheit:
- Voraussetzungen:
  - Kaserne Level 3
- Resourcen-Kosten:
  - Geld: €
  - Stein: t
  - Stahl: t

### Fahrzeugfabrik

Die Fahrzeugfabrik kann auf 4 Level aufgerüstet werden um unterschiedliche Einheitentypen freizuschalten.

#### Level 1

- Beschreibung:
- Einheit:
- Voraussetzungen:
  - Rathaus
- Resourcen-Kosten:
  - Geld: €
  - Stein: t
  - Stahl: t

#### Level 2

- Beschreibung:
- Einheit:
- Voraussetzungen:
  - Fahrzeugfabrik Level 1
- Resourcen-Kosten:
  - Geld: €
  - Stein: t
  - Stahl: t

#### Level 3

- Beschreibung:
- Einheit:
- Voraussetzungen:
  - Fahrzeugfabrik Level 2
- Resourcen-Kosten:
  - Geld: €
  - Stein: t
  - Stahl: t

#### Level 4

- Beschreibung:
- Einheit:
- Voraussetzungen:
  - Fahrzeugfabrik Level 3
- Resourcen-Kosten:
  - Geld: €
  - Stein: t
  - Stahl: t

### Schiffswerft

Die Schiffswerft kann auf 4 Level aufgerüstet werden um unterschiedliche Einheitentypen freizuschalten.

#### Level 1

- Beschreibung:
- Einheit:
- Voraussetzungen:
  - Rathaus
- Resourcen-Kosten:
  - Geld: €
  - Stein: t
  - Stahl: t

#### Level 2

- Beschreibung:
- Einheit:
- Voraussetzungen:
  - Schiffswerft Level 1
- Resourcen-Kosten:
  - Geld: €
  - Stein: t
  - Stahl: t

#### Level 3

- Beschreibung:
- Einheit:
- Voraussetzungen:
  - Schiffswerft Level 2
- Resourcen-Kosten:
  - Geld: €
  - Stein: t
  - Stahl: t

#### Level 4

- Beschreibung:
- Einheit:
- Voraussetzungen:
  - Schiffswerft Level 3
- Resourcen-Kosten:
  - Geld: €
  - Stein: t
  - Stahl: t

### Flugplatz

Der Flugplatz kann auf 4 Level aufgerüstet werden um unterschiedliche Einheitentypen freizuschalten.

#### Level 1

- Beschreibung:
- Einheit:
- Voraussetzungen:
  - Rathaus
- Resourcen-Kosten:
  - Geld: €
  - Stein: t
  - Stahl: t

#### Level 2

- Beschreibung:
- Einheit:
- Voraussetzungen:
  - Flugplatz Level 1
- Resourcen-Kosten:
  - Geld: €
  - Stein: t
  - Stahl: t

#### Level 3

- Beschreibung:
- Einheit:
- Voraussetzungen:
  - Flugplatz Level 2
- Resourcen-Kosten:
  - Geld: €
  - Stein: t
  - Stahl: t

#### Level 4

- Beschreibung:
- Einheit:
- Voraussetzungen:
  - Flugplatz Level 3
- Resourcen-Kosten:
  - Geld: €
  - Stein: t
  - Stahl: t

## Regierungsgebäude

### Geheimdienstzentrum

- Beschreibung:
- Voraussetzungen:
  - Rathaus
- Resourcen-Kosten:
  - Geld: €
  - Stein: t
  - Stahl: t
- Resourcen-Produktion:
  - Geld: €
  - Stein: t
  - Stahl: t
- Energie-Bilanz:
  - Strom-Verbrauch: Mwh
  - Strom-Produktion: Mwh

### Forschungslabor

- Beschreibung:
- Voraussetzungen:
  - Rathaus
- Resourcen-Kosten:
  - Geld: €
  - Stein: t
  - Stahl: t
- Resourcen-Produktion:
  - Geld: €
  - Stein: t
  - Stahl: t
- Energie-Bilanz:
  - Strom-Verbrauch: Mwh
  - Strom-Produktion: Mwh

### Bank

- Beschreibung:
- Voraussetzungen:
  - Rathaus
- Resourcen-Kosten:
  - Geld: €
  - Stein: t
  - Stahl: t
- Resourcen-Produktion:
  - Geld: €
  - Stein: t
  - Stahl: t
- Energie-Bilanz:
  - Strom-Verbrauch: Mwh
  - Strom-Produktion: Mwh

## Verteidigung

### Gegenspionage

- Beschreibung:
- Voraussetzungen:
  - Rathaus
- Resourcen-Kosten:
  - Geld: €
  - Stein: t
  - Stahl: t
- Resourcen-Produktion:
  - Geld: €
  - Stein: t
  - Stahl: t
- Energie-Bilanz:
  - Strom-Verbrauch: Mwh
  - Strom-Produktion: Mwh

### Landverteidigung

- Beschreibung:
- Voraussetzungen:
  - Rathaus
- Resourcen-Kosten:
  - Geld: €
  - Stein: t
  - Stahl: t
- Resourcen-Produktion:
  - Geld: €
  - Stein: t
  - Stahl: t
- Energie-Bilanz:
  - Strom-Verbrauch: Mwh
  - Strom-Produktion: Mwh

### Seeverteidigung

- Beschreibung:
- Voraussetzungen:
  - Rathaus
- Resourcen-Kosten:
  - Geld: €
  - Stein: t
  - Stahl: t
- Resourcen-Produktion:
  - Geld: €
  - Stein: t
  - Stahl: t
- Energie-Bilanz:
  - Strom-Verbrauch: Mwh
  - Strom-Produktion: Mwh

### Luftverteidigung

- Beschreibung:
- Voraussetzungen:
  - Rathaus
- Resourcen-Kosten:
  - Geld: €
  - Stein: t
  - Stahl: t
- Resourcen-Produktion:
  - Geld: €
  - Stein: t
  - Stahl: t
- Energie-Bilanz:
  - Strom-Verbrauch: Mwh
  - Strom-Produktion: Mwh
