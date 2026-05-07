/* Benutzergebäude: Verknüpfung zwischen Benutzern und ihren Gebäuden */
CREATE TABLE IF NOT EXISTS user_buildings (
    id SERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    building_type_id INTEGER NOT NULL,
    level INTEGER DEFAULT 1,
    
    -- Bau-Status
    is_constructing BOOLEAN DEFAULT FALSE,
    construction_start_time TIMESTAMPTZ,
    construction_end_time TIMESTAMPTZ,
    
    -- Position
    location_x INTEGER,
    location_y INTEGER,
    
    -- Energie-Tracking (berechnet aus building_types)
    current_power_consumption INTEGER DEFAULT 0, -- Mwh pro Tick
    current_power_production INTEGER DEFAULT 0, -- Mwh pro Tick
    
    -- Ressourcen-Produktion (berechnet aus building_types)
    current_money_production INTEGER DEFAULT 0,
    current_stone_production INTEGER DEFAULT 0,
    current_steel_production INTEGER DEFAULT 0,
    current_fuel_production INTEGER DEFAULT 0,
    
    -- Zeitstempel
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (building_type_id) REFERENCES building_types(id)
);

-- Indices für schnelle Abfragen
CREATE INDEX idx_user_buildings_user_id ON user_buildings(user_id);
CREATE INDEX idx_user_buildings_constructing ON user_buildings(is_constructing);
CREATE INDEX idx_user_buildings_location ON user_buildings(location_x, location_y);
