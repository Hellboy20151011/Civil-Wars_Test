/* Benutzerressourcen: Verknüpfung zwischen Benutzern und ihren Ressourcen */
CREATE TABLE IF NOT EXISTS user_resources (
    id SERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    resource_type_id INTEGER NOT NULL,
    amount BIGINT DEFAULT 0, -- Große Zahlen möglich
    
    -- Letzter Update für Produktion
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (resource_type_id) REFERENCES resource_types(id),

    CONSTRAINT unique_user_resource UNIQUE (user_id, resource_type_id)
);

-- Index für schnelle Spieler-Abfragen
CREATE INDEX idx_user_resources_user_id ON user_resources(user_id);

-- Initialisiere mit 0 für jeden Spieler und jede Ressource bei Bedarf über INSERT-Trigger
