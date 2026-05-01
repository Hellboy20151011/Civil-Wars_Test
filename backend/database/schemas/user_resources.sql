/* Benutzerressourcen: Verknüpfung zwischen Benutzern und ihren Ressourcen */
CREATE TABLE user_resources (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    resource_type_id INTEGER NOT NULL,
    amount INTEGER DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (resource_type_id) REFERENCES resource_types(id)
);
