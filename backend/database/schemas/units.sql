/* Einheitentypen mit Kosten, Statistiken und Ausbildungszeit
 * Ausbildungszeiten in Ticks (1 Tick = 10 Min in Production, 1 Min in Dev)
 * Kosten: money_cost (€), steel_cost (t), fuel_cost (L)
 */

CREATE TABLE IF NOT EXISTS unit_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    category VARCHAR(100) NOT NULL, -- 'infantry', 'vehicle', 'ship', 'air', 'defense'
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
('Soldat', 'infantry', 'Kaserne Level 1', 'Das Rückgrat der Armee. In großer Zahl bildet er eine schlagkräftige Truppe.', 10000, 15, 25, 0.5, 70, 7, 15, 3, 'Frontlinie-Angriff', 'Panzergrenadier'),
('Panzergrenadier', 'infantry', 'Kaserne Level 2', 'Armierter Infanterist mit panzerbrechenden Granaten, spezialisiert auf Fahrzeugbekämpfung.', 30000, 45, 70, 1, 100, 12, 22, 2, 'Panzerbrechende Granaten, Fahrzeugbekämpfung', 'Soldat'),
('Kampftaucher', 'infantry', 'Kaserne Level 3', 'Eliteeinheit für verdeckte Unterwasseroperationen und Sabotage.', 70000, 90, 140, 2, 130, 15, 28, 4, 'Unterwasseroperationen, Sabotage', 'Panzergrenadier'),
('Fallschirmjäger', 'infantry', 'Kaserne Level 4', 'Luftbewegliche Infanterie für Überraschungsangriffe und strategische Luftlandungen.', 120000, 170, 250, 3, 150, 20, 25, 6, 'Luftlandung, Überraschungsangriff', 'Kampftaucher'),
('Elitesoldat', 'infantry', 'Kaserne Level 5', 'Stärkste Infanterieeinheit – hochtrainierte Spezialisten mit modernster Ausrüstung.', 220000, 280, 450, 5.5, 220, 28, 45, 5, 'Hochpräzisions-Einsätze, Spezialoperationen', 'Fallschirmjäger'),

-- FAHRZEUGFABRIK-EINHEITEN
('Luchs', 'vehicle', 'Fahrzeugfabrik Level 1', 'Leichter Spähpanzer mit hoher Mobilität für Aufklärungsmissionen.', 18000, 45, 90, 0.5, 65, 6, 12, 7, 'Schnelle Aufklärung, Geländegängigkeit', NULL),
('Minenräumer', 'vehicle', 'Fahrzeugfabrik Level 2', 'Gepanzertes Fahrzeug zur Räumung von Minenfeldern und Panzersperren.', 50000, 130, 220, 1.5, 115, 0, 20, 2, 'Minenfelder räumen, Panzersperren beseitigen', NULL),
('Leopard 2', 'vehicle', 'Fahrzeugfabrik Level 3', 'Moderner Hauptkampfpanzer mit starker Panzerung und Hochdruckkanone.', 220000, 550, 750, 4, 320, 38, 55, 3, 'Panzerung, Hochdruckkanone', 'Luchs'),
('Mobile Flak', 'vehicle', 'Fahrzeugfabrik Level 4', 'Bewegliche Flugabwehreinheit auf gepanzertem Fahrgestell.', 160000, 320, 430, 3, 160, 22, 22, 4, 'Flugabwehr (Reichweite 5), Raketenabwehr', 'Leopard 2'),
('Panzerhaubitze 2000', 'vehicle', 'Fahrzeugfabrik Level 5', 'Modernes Artilleriesystem auf Panzerkette mit hochpräzisem Weitstreckenbeschuss.', 380000, 1050, 1500, 7, 340, 48, 32, 2, 'Artilleriebeschuss (Reichweite 12), Präzisionsfeuer', 'Mobile Flak'),

-- WERFT-EINHEITEN
('Kreuzer', 'ship', 'Schiffswerft Level 1', 'Vielseitiges Kriegsschiff für kombinierte See- und Küstenoperationen.', 90000, 160, 220, 1.5, 130, 16, 22, 4, 'Kombinierter Beschuss, Küstenunterstützung', NULL),
('Zerstörer', 'ship', 'Schiffswerft Level 2', 'Schnelles Kriegsschiff mit U-Boot-Bekämpfungskapazitäten und Torpedos.', 220000, 420, 530, 3, 220, 28, 28, 5, 'U-Boot-Bekämpfung, Torpedoangriff', 'Kreuzer'),
('Fregatte', 'ship', 'Schiffswerft Level 3', 'Mittleres Kriegsschiff mit ausgeglichenen Kampf- und Verteidigungswerten sowie Flugabwehr.', 380000, 750, 950, 5, 300, 32, 38, 3, 'Flugabwehr, Radar-Aufklärung', 'Zerstörer'),
('U-Boot Typhoon', 'ship', 'Schiffswerft Level 4', 'Atomgetriebenes U-Boot der Typhoon-Klasse mit ballistischen Cruise-Missiles.', 650000, 1300, 1600, 8, 270, 45, 22, 2, 'Tarnung (unsichtbar bis Angriff), Cruise-Missiles', 'Fregatte'),
('Flugzeugträger', 'ship', 'Schiffswerft Level 5', 'Riesiges Kampfschiff mit Hangar für Kampfjets und starker Flugabwehr.', 1600000, 3200, 4200, 14, 650, 22, 65, 1, 'Träger für Kampfjets, Starke Flugabwehr', 'U-Boot Typhoon'),

-- FLUGPLATZ-EINHEITEN
('Seahawk', 'air', 'Flugplatz Level 1', 'Marinehubschrauber für Seeaufklärung und U-Boot-Bekämpfung.', 75000, 60, 190, 1, 75, 13, 14, 7, 'Marineaufklärung, U-Boot-Bekämpfung', NULL),
('Apache', 'air', 'Flugplatz Level 2', 'Kampfhubschrauber mit präzisen Panzerabwehrraketen und hoher Feuerkraft.', 190000, 130, 420, 2, 115, 28, 20, 6, 'Panzerangriff, Präzisionsraketen', 'Seahawk'),
('Eurofighter', 'air', 'Flugplatz Level 3', 'Mehrzweckkampfflugzeug für Luftüberlegenheit und Bodenunterstützung.', 370000, 210, 850, 3, 135, 38, 22, 10, 'Luftüberlegenheit, Mehrzweckkampf', 'Apache'),
('Mig-35', 'air', 'Flugplatz Level 4', 'Hochmanövrierbares Mehrzweckkampfflugzeug mit Kurzstreckenraketen.', 420000, 230, 950, 4, 145, 42, 20, 11, 'Hochmanövrierbarkeit, Kurzstreckenraketen', 'Eurofighter'),
('B2 Bomber', 'air', 'Flugplatz Level 5', 'Tarnkappenbomber für strategische Flächenbombardements tief im Feindesgebiet.', 900000, 550, 2200, 7, 190, 60, 16, 8, 'Tarnkappenbomber, Flächenbombardement (Reichweite 10)', 'Mig-35'),

-- VERTEIDIGUNGSANLAGEN (Bodenverteidigung)
('MG-Stellung', 'defense', 'Landverteidigung Level 1', 'Befestigte Maschinengewehrstellung zur Abwehr von Infanterie und leichten Fahrzeugen.', 22000, 55, 0, 0.5, 65, 9, 28, 0, 'Feuerkontrolle, Breitseite', NULL),
('Mine', 'defense', 'Landverteidigung Level 2', 'Versteckte Landmine – explodiert beim Überqueren durch feindliche Einheiten.', 6000, 12, 0, 0.25, 25, 18, 12, 0, 'Explosion bei Überquerung', NULL),
('Artillerie', 'defense', 'Landverteidigung Level 3', 'Stationäres Artilleriegeschütz mit weitreichendem Feuerkorridor.', 130000, 320, 60, 2.5, 110, 42, 22, 0, 'Artilleriebeschuss (Reichweite 10)', NULL),

-- VERTEIDIGUNGSANLAGEN (Seeverteidigung)
('Unterwassermine', 'defense', 'Seeverteidigung Level 1', 'Getarnte Unterwassermine zur Bekämpfung feindlicher Schiffe und U-Boote.', 18000, 35, 0, 0.5, 45, 25, 8, 0, 'Unterwasserexplosion, Tarnung', NULL),
('Küstengeschützturm', 'defense', 'Seeverteidigung Level 2', 'Befestigter Küstenturm mit schwerem Geschütz gegen Seeziele.', 90000, 220, 0, 2, 160, 28, 45, 0, 'Küstenbeschuss (Reichweite 8)', NULL),
('Küstenartillerie', 'defense', 'Seeverteidigung Level 3', 'Schwere Küstenbatterie für weitreichenden Beschuss von Seekriegsschiffen.', 160000, 420, 55, 3, 190, 48, 48, 0, 'Schwerer Küstenbeschuss (Reichweite 12)', NULL),

-- VERTEIDIGUNGSANLAGEN (Luftverteidigung)
('2cm Flak', 'defense', 'Luftverteidigung Level 1', 'Leichte Flugabwehrkanone zur Bekämpfung tief fliegender Luftfahrzeuge.', 32000, 65, 12, 0.5, 55, 16, 22, 0, 'Flugabwehr (Reichweite 4)', NULL),
('15cm Flak', 'defense', 'Luftverteidigung Level 2', 'Schwere Flugabwehrkanone mit großer Reichweite gegen Hochflugziele.', 110000, 260, 25, 2, 130, 32, 38, 0, 'Schwere Flugabwehr (Reichweite 7)', NULL),
('Patriot-System', 'defense', 'Luftverteidigung Level 3', 'Hochmodernes Flugabwehr-Raketensystem zur Abwehr ballistischer Raketen und Kampfjets.', 550000, 1100, 120, 5, 220, 55, 65, 0, 'Raketenabwehr, Hochpräzisions-SAM', NULL),

-- GEHEIMDIENST-EINHEITEN
('Spion', 'intel', 'Geheimdienstzentrum Level 1', 'Verdeckter Agent für Aufklärung und Informationsbeschaffung hinter feindlichen Linien. Höhere Anzahl erhöht Erfolgswahrscheinlichkeit und Berichtdetail.', 50000, 0, 80, 2, 60, 0, 5, 5, 'Spionage, Tarnung', NULL),
('SR-71 Aufklärer', 'intel', 'Geheimdienstzentrum Level 2', 'Hochgeschwindigkeits-Aufklärungsjet für schnelle und weitreichende Informationsbeschaffung.', 320000, 180, 650, 4, 80, 0, 8, 12, 'Schnelle Spionage, Luftaufklärung (Reichweite 20)', NULL),
('Spionagesatellit', 'intel', 'Geheimdienstzentrum Level 3', 'Orbitales Aufklärungssystem mit nahezu garantierter Erfolgsrate und vollständigen Berichten.', 1200000, 500, 1200, 8, 100, 0, 12, 20, 'Vollständige Aufklärung, kaum abfangbar', NULL);
