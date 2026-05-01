/* Resourcentypen: 
- 1: "Stein"
- 2: "Metall"
- 3: "Geld"
*/

CREATE TABLE resource_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL
);
INSERT INTO resource_types (name) VALUES
('Stein'),
('Metall'),
('Geld');
