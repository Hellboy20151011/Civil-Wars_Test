/* Resourcentypen: 
- 1: "Geld" (€)
- 2: "Stein" (t)
- 3: "Stahl" (t)
- 4: "Treibstoff" (L)
- 5: "Strom" (Mwh - nur für Bilanz)
*/

CREATE TABLE IF NOT EXISTS resource_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    unit VARCHAR(50) NOT NULL
);
INSERT INTO resource_types (name, unit) VALUES
('Geld', '€'),
('Stein', 't'),
('Stahl', 't'),
('Treibstoff', 'L'),
('Strom', 'Mwh')
ON CONFLICT (name) DO NOTHING;
