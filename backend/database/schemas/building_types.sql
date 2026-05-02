/* Gebäudetypen mit Kosten, Produktion, Stromverbrauch und Bauzeit
 * Bauzeiten sind in Ticks (1 Tick = 10 Min in Production, 1 Min in Dev)
 * Ressourcenkosten: money_cost (€), stone_cost (t), steel_cost (t), fuel_cost (L)
 * Ressourcenproduktion: stone_production, steel_production, money_production, fuel_production (pro Tick)
 * Strom: power_consumption, power_production (Mwh pro Tick)
 */

CREATE TABLE IF NOT EXISTS building_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    category VARCHAR(100) NOT NULL, -- 'infrastructure', 'housing', 'military', 'government', 'defense'
    description TEXT,
    level INTEGER DEFAULT 1, -- Stufe des Gebäudes (1-4 typischerweise)
    prerequisite_building VARCHAR(255), -- Erforderliches vorheriges Gebäude
    max_prerequisite_level INTEGER, -- Maximale vorherige Stufe
    
    -- Kosten zum Bauen
    money_cost INTEGER DEFAULT 0,
    stone_cost INTEGER DEFAULT 0,
    steel_cost INTEGER DEFAULT 0,
    fuel_cost INTEGER DEFAULT 0,
    
    -- Ressourcenproduktion pro Tick
    money_production INTEGER DEFAULT 0,
    stone_production INTEGER DEFAULT 0,
    steel_production INTEGER DEFAULT 0,
    fuel_production INTEGER DEFAULT 0,
    
    -- Energiebilanz (Mwh pro Tick)
    power_consumption INTEGER DEFAULT 0,
    power_production INTEGER DEFAULT 0,
    
    -- Bevölkerung
    population INTEGER DEFAULT 0,
    
    -- Bauzeit in Ticks
    build_time_ticks DECIMAL(4,2) DEFAULT 1,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- VERSORGUNGSGEBÄUDE
INSERT INTO building_types (name, category, description, level, money_cost, stone_cost, steel_cost, power_consumption, power_production, build_time_ticks) VALUES
('Rathaus', 'infrastructure', 'Die Zentrale deiner Herrschaft. Ohne Rathaus kein Reich.', 1, 0, 0, 0, 0, 0, 1),
('Kraftwerk', 'infrastructure', 'Das Rückgrat deiner Infrastruktur. Produziert 50Mwh pro Tick.', 1, 100000, 20, 15, 0, 50, 1),
('Steinbruch', 'infrastructure', 'Produziert 10t Stein pro Tick. Kostet 10Mwh Strom.', 1, 115000, 10, 15, 10, 0, 0.5),
('Stahlwerk', 'infrastructure', 'Produziert 7t Stahl pro Tick. Kostet 15Mwh Strom.', 1, 130000, 30, 20, 15, 0, 1),
('Ölpumpe', 'infrastructure', 'Fördert Rohöl für Treibstoffproduktion. Kostet 5Mwh Strom.', 1, 150000, 10, 30, 5, 0, 1.1),
('Öl-Raffinerie', 'infrastructure', 'Produziert 10L Treibstoff pro Tick. Kostet 15Mwh Strom.', 1, 250000, 30, 45, 15, 0, 2),

-- UNTERKÜNFTE
('Wohnhaus', 'housing', 'Grundgebäude für Geldproduktion. Produziert 5.000€ pro Tick.', 1, 80000, 5, 7, 5, 0, 0.5),
('Reihenhaus', 'housing', 'Gehobene Wohnvariante. Produziert 8.000€ pro Tick.', 1, 120000, 12, 18, 8, 0, 1),
('Mehrfamilienhaus', 'housing', 'Größeres Wohngebäude. Produziert 12.000€ pro Tick.', 1, 165000, 15, 24, 11, 0, 1.5),
('Hochhaus', 'housing', 'Größtes Wohngebäude der Basis. Produziert 18.000€ pro Tick.', 1, 225000, 20, 40, 20, 0, 2),

-- KASERNE (4 Level)
('Kaserne Level 1', 'military', 'Basisstufe der Kaserne - Soldat', 1, 150000, 40, 50, 0, 0, 1.5),
('Kaserne Level 2', 'military', 'Erste Erweiterung - Pionier', 2, 500000, 100, 120, 0, 0, 3),
('Kaserne Level 3', 'military', 'Zweite Ausbaustufe - Minentaucher', 3, 1000000, 300, 500, 0, 0, 6),
('Kaserne Level 4', 'military', 'Letzte Ausbaustufe - Seal', 4, 2500000, 1000, 2500, 0, 0, 12),

-- FAHRZEUGFABRIK (4 Level)
('Fahrzeugfabrik Level 1', 'military', 'Basisstufe - Jeep', 1, 250000, 75, 90, 0, 0, 1.5),
('Fahrzeugfabrik Level 2', 'military', 'Erste Entwicklungsstufe - Minenleger', 2, 500000, 185, 235, 0, 0, 4.5),
('Fahrzeugfabrik Level 3', 'military', 'Zweite Aufwertungsstufe - Kampfpanzer', 3, 1500000, 465, 675, 0, 0, 9),
('Fahrzeugfabrik Level 4', 'military', 'Stufe 4 - Panzerhaubitze', 4, 3000000, 1150, 3200, 0, 0, 12),

-- SCHIFFSWERFT (4 Level)
('Schiffswerft Level 1', 'military', 'Basisstufe - Torpedoboot', 1, 280000, 85, 105, 0, 0, 2),
('Schiffswerft Level 2', 'military', 'Erste Entwicklungsstufe - Fregatte', 2, 600000, 210, 280, 0, 0, 6),
('Schiffswerft Level 3', 'military', 'Zweite Ausbaustufe - U-Boot', 3, 1800000, 540, 810, 0, 0, 12),
('Schiffswerft Level 4', 'military', 'Höchste Ausbaustufe - Flugzeugträger', 4, 3500000, 1300, 3500, 0, 0, 18),

-- FLUGPLATZ (4 Level)
('Flugplatz Level 1', 'military', 'Basisstufe - Kampfhubschrauber', 1, 300000, 95, 120, 0, 0, 2.5),
('Flugplatz Level 2', 'military', 'Erste Entwicklungsstufe - Kampfjet', 2, 700000, 245, 350, 0, 0, 7.5),
('Flugplatz Level 3', 'military', 'Zweite Ausbaustufe - Bomber', 3, 2000000, 650, 950, 0, 0, 15),
('Flugplatz Level 4', 'military', 'Höchste Ausbaustufe - Transportflugzeug', 4, 4000000, 1500, 4000, 0, 0, 20),

-- REGIERUNGSGEBÄUDE
('Geheimdienstzentrum Level 1', 'government', 'Basisstufe - Spion', 1, 140000, 45, 65, 0, 0, 1),
('Geheimdienstzentrum Level 2', 'government', 'Erste Erweiterung - SR-71 Blackbird', 2, 420000, 160, 260, 0, 0, 3),
('Geheimdienstzentrum Level 3', 'government', 'Höchste Ausbaustufe - Spionagesatellit', 3, 1100000, 500, 900, 0, 0, 9),

('Forschungslabor Level 1', 'government', 'Basisstufe - Grundlagentechnik', 1, 200000, 60, 80, 0, 0, 2),
('Forschungslabor Level 2', 'government', 'Erste Erweiterung - Fortgeschrittene Technologie', 2, 600000, 200, 300, 0, 0, 6),
('Forschungslabor Level 3', 'government', 'Höchste Ausbaustufe - Militärische Spitzentechnologie', 3, 1500000, 600, 1000, 0, 0, 12),

('Bank Level 1', 'government', 'Basisstufe - 1% Zinsen auf Depot', 1, 120000, 25, 40, 0, 0, 1),
('Bank Level 2', 'government', 'Erste Erweiterung - 2% Zinsen auf Depot', 2, 350000, 100, 150, 0, 0, 2.5),
('Bank Level 3', 'government', 'Höchste Ausbaustufe - 5% Zinsen auf Depot', 3, 800000, 300, 500, 0, 0, 6),

-- VERTEIDIGUNGSGEBÄUDE
('Gegenspionage Level 1', 'defense', 'Basisstufe - Stacheldraht', 1, 100000, 30, 50, 0, 0, 0.5),
('Gegenspionage Level 2', 'defense', 'Erste Erweiterung - Abfangjäger', 2, 350000, 120, 200, 0, 0, 2),
('Gegenspionage Level 3', 'defense', 'Höchste Ausbaustufe - Spionagesatellit', 3, 900000, 400, 700, 0, 0, 6),

('Landverteidigung Level 1', 'defense', 'Basisstufe - MG-Nest', 1, 80000, 25, 35, 0, 0, 0.5),
('Landverteidigung Level 2', 'defense', 'Erste Erweiterung - Minen', 2, 250000, 100, 150, 0, 0, 1.5),
('Landverteidigung Level 3', 'defense', 'Höchste Ausbaustufe - Geschützturm', 3, 700000, 350, 600, 0, 0, 5),

('Seeverteidigung Level 1', 'defense', 'Basisstufe - Torpedoboote', 1, 150000, 50, 80, 0, 0, 1),
('Seeverteidigung Level 2', 'defense', 'Erste Erweiterung - Unterwasserminen', 2, 400000, 150, 250, 0, 0, 3),
('Seeverteidigung Level 3', 'defense', 'Höchste Ausbaustufe - Küstenbatterie', 3, 1000000, 450, 800, 0, 0, 7),

('Luftverteidigung Level 1', 'defense', 'Basisstufe - Flugabwehrkanone', 1, 120000, 40, 60, 0, 0, 1),
('Luftverteidigung Level 2', 'defense', 'Erste Erweiterung - RAM-Missile', 2, 350000, 130, 220, 0, 0, 2.5),
('Luftverteidigung Level 3', 'defense', 'Höchste Ausbaustufe - SM-1 Missile', 3, 950000, 420, 750, 0, 0, 7.5);
