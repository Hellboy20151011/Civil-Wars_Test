/* Spieler-Einheiten: Verknüpfung zwischen Spielern und ihren trainierten Einheiten */

CREATE TABLE IF NOT EXISTS user_units (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    unit_type_id INTEGER NOT NULL,
    quantity INTEGER DEFAULT 0,
    
    -- Position
    location_x INTEGER,
    location_y INTEGER,
    
    -- Status
    is_moving BOOLEAN DEFAULT FALSE,
    destination_x INTEGER,
    destination_y INTEGER,
    arrival_time TIMESTAMP,
    
    -- Zustand
    health_percentage INTEGER DEFAULT 100, -- 0-100%
    experience_points INTEGER DEFAULT 0,
    
    -- Zeitstempel
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (unit_type_id) REFERENCES unit_types(id)
);

-- Index für schnelle Spieler-Abfragen
CREATE INDEX idx_user_units_user_id ON user_units(user_id);
CREATE INDEX idx_user_units_location ON user_units(location_x, location_y);
CREATE INDEX idx_user_units_moving ON user_units(is_moving);
