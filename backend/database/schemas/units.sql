/* Einheitentypen mit Kosten, Statistiken und Ausbildungszeit
 * Ausbildungszeiten in Ticks (1 Tick = 10 Min in Production, 1 Min in Dev)
 * Kosten: money_cost (€), steel_cost (t), fuel_cost (L)
 */

CREATE TABLE IF NOT EXISTS unit_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    category VARCHAR(100) NOT NULL, -- 'infantry', 'vehicle', 'ship', 'air', 'spionage', 'defense'
    building_requirement VARCHAR(255) NOT NULL, -- Erforderliches Gebäude zur Ausbildung
    description TEXT,
    
    -- Ausbildungskosten
    money_cost INTEGER NOT NULL,
    steel_cost INTEGER NOT NULL,
    fuel_cost INTEGER NOT NULL,
    
    -- Ausbildungszeit in Ticks
    training_time_ticks DECIMAL(4,2) NOT NULL,
    
    -- Kampfstatistiken
    hitpoints INTEGER NOT NULL,
    attack_points INTEGER NOT NULL,
    defense_points INTEGER NOT NULL,
    
    -- Bewegung
    movement_speed DECIMAL(4,2) NOT NULL, -- Felder pro Tick
    
    -- Spezialfähigkeiten
    special_ability VARCHAR(255),
    
    -- Sonstiges
    counter_unit VARCHAR(255), -- Effektiv gegen diese Einheit
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- KASERNEN-EINHEITEN
INSERT INTO unit_types (name, category, building_requirement, description, money_cost, steel_cost, fuel_cost, training_time_ticks, hitpoints, attack_points, defense_points, movement_speed, special_ability, counter_unit) VALUES
('Soldat', 'infantry', 'Kaserne Level 1', 'Der Soldat ist das Rückgrat der Armee.', 10000, 15, 25, 0.5, 70, 7, 15, 3, 'Frontlinie-Angriff', 'Pionier'),
('Pionier', 'infantry', 'Kaserne Level 2', 'Spezialisiert auf Befestigungen und Minenräumung.', 25000, 30, 50, 1, 90, 5, 20, 2, 'Befestigungen bauen, Minen räumen', 'Soldat'),
('Minentaucher', 'infantry', 'Kaserne Level 3', 'Eliteeinheit für Unterwasseroperationen.', 60000, 75, 120, 2, 120, 12, 25, 4, 'Unterwassernavigation, Bombenlegen', 'Pionier'),
('Seal', 'infantry', 'Kaserne Level 4', 'Stärkste Infanterieeinheit - Spezialisten mit modernster Ausrüstung.', 150000, 200, 300, 4, 180, 20, 35, 5, 'Amphibische Operationen, Hochpräzisions-Missionen', 'Minentaucher'),

-- FAHRZEUG-EINHEITEN
('Jeep', 'vehicle', 'Fahrzeugfabrik Level 1', 'Leichtes, schnelles Aufklärungsfahrzeug.', 15000, 40, 80, 0.5, 50, 4, 8, 6, 'Schnelle Aufklärung, Hohe Wendigkeit', NULL),
('Minenleger', 'vehicle', 'Fahrzeugfabrik Level 2', 'Gepanzertes Fahrzeug zur Verlegung von Minenfeldern.', 45000, 120, 200, 1.5, 100, 0, 15, 2, 'Minenfelder verlegen, Minenräumung', NULL),
('Kampfpanzer', 'vehicle', 'Fahrzeugfabrik Level 3', 'Schwerer gepanzerter Kampfwagen mit starker Feuerkraft.', 120000, 350, 500, 3, 250, 25, 40, 3, 'Panzerung verstärkt bei Verteidigung', 'Jeep'),
('Panzerhaubitze', 'vehicle', 'Fahrzeugfabrik Level 4', 'Schwerstes Panzerfahrzeug mit Artillerie-Geschütz.', 300000, 900, 1200, 6, 300, 35, 30, 2, 'Artilleriebeschuss (Reichweite 10), Flächenschaden', 'Kampfpanzer'),

-- SCHIFFS-EINHEITEN
('Torpedoboot', 'ship', 'Schiffswerft Level 1', 'Schnelles, wendiges Kriegsschiff mit Torpedos.', 50000, 100, 150, 1, 80, 12, 10, 5, 'Torpedoangriff (Reichweite 5)', NULL),
('Fregatte', 'ship', 'Schiffswerft Level 2', 'Mittleres Kriegsschiff mit Panzerung und Feuerkraft.', 150000, 300, 400, 3, 180, 20, 25, 3, 'Flugabwehr, Kombinierter Angriff', 'Torpedoboot'),
('U-Boot', 'ship', 'Schiffswerft Level 3', 'Getauchtes Kriegsschiff für überraschende Angriffe.', 400000, 800, 1000, 6, 150, 30, 15, 2, 'Tarnung (unsichtbar bis Angriff), Doppel-Torpedos', 'Fregatte'),
('Flugzeugträger', 'ship', 'Schiffswerft Level 4', 'Riesiges Kampfschiff mit Hangar für bis zu 5 Kampfjets.', 1200000, 2500, 3000, 12, 500, 15, 50, 1, 'Träger für Flugzeuge, Starke Flugabwehr', 'U-Boot'),

-- LUFT-EINHEITEN
('Kampfhubschrauber', 'air', 'Flugplatz Level 1', 'Wendiger, bewaffneter Hubschrauber für Luftkampf.', 80000, 60, 200, 1, 60, 15, 12, 6, 'Schwebefähigkeit, Bodenunterstützung', NULL),
('Kampfjet', 'air', 'Flugplatz Level 2', 'Schneller Jet mit moderner Luftkampfausrüstung.', 250000, 150, 600, 2, 100, 25, 15, 8, 'Überschallflug, Mehrfach-Raketen', 'Kampfhubschrauber'),
('Bomber', 'air', 'Flugplatz Level 3', 'Großes Flugzeug für Flächenbombardements.', 600000, 400, 1500, 5, 200, 40, 10, 4, 'Flächenbombardement (Reichweite 8), Massive Zerstörung', 'Kampfjet'),
('Transportflugzeug', 'air', 'Flugplatz Level 4', 'Großes Frachtflugzeug für Truppentransporte.', 500000, 350, 1200, 4, 150, 0, 8, 7, 'Transport von bis zu 10 Infanterie-Einheiten, Luftlandungen', NULL),

-- SPIONAGE-EINHEITEN
('Spion', 'spionage', 'Geheimdienstzentrum Level 1', 'Verdeckt arbeitender Agent für Informationsbeschaffung.', 5000, 0, 10, 0.25, 20, 0, 5, 4, 'Spionage, Informationen sammeln', NULL),
('SR-71 Blackbird', 'spionage', 'Geheimdienstzentrum Level 2', 'Schnellstes Aufklärungsflugzeug für verdeckte Luftaufklärung.', 50000, 80, 500, 1, 40, 0, 8, 10, 'Hochgeschwindigkeits-Aufklärung, Radar-Tarnung', NULL),
('Spionagesatellit', 'spionage', 'Geheimdienstzentrum Level 3', 'Orbital positionierter Satellit für globale Überwachung.', 500000, 1000, 0, 10, 200, 0, 0, 0, 'Echtzeit-Satellitenaufnahmen, Feindzielerfassung', NULL);
