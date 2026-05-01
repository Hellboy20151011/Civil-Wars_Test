/* Benutzergebäude: Verknüpfung zwischen Benutzern und ihren Gebäuden */
CREATE TABLE user_buildings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    building_type_id INTEGER NOT NULL,
    level INTEGER DEFAULT 1,
    construction_start_time TIMESTAMP,
    construction_end_time TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (building_type_id) REFERENCES building_types(id)
);
