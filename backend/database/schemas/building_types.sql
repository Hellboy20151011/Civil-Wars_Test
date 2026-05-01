/* Gebäudearten inklusive Resourcen-Kosten, Beschreibung, Stromverbrauch bzw Stromproduktion und Bauzeit */

/*Rathaus: Keine Baukosten, kein Stromverbrauch, 1 Minute Bauzeit
*/

/* Kraftwerk:
25t Stein, 10t Metall, 100.000€, 50 Stromproduktion, Bauzeit 6 Minuten
*/

/* Wohnhaus:
10t Stein,
5t Metall,
20.000€,
10 Stromverbrauch,
Bauzeit 3 Minuten,
produziert 20.000€
Enthält 5 Einwohner
*/

CREATE TABLE if not exists building_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    stone_cost INTEGER,
    metal_cost INTEGER,
    money_cost INTEGER,
    power_consumption INTEGER,
    power_production INTEGER,
    stone_production INTEGER,
    metal_production INTEGER,
    money_production INTEGER,
    population INTEGER,
    build_time INTEGER
);
INSERT INTO building_types (name, description, stone_cost, metal_cost, money_cost, power_consumption, power_production, stone_production, metal_production, money_production, population, build_time) VALUES
('Rathaus', 'Das Rathaus ist das zentrale Verwaltungsgebäude der Stadt. Es hat keine Baukosten und keinen Stromverbrauch. Die Bauzeit beträgt 1 Minute.', 0, 0, 0, 0, 0, 0, 0, 0, 0, 1),
('Kraftwerk', 'Das Kraftwerk produziert Strom für die Stadt. Es kostet 25t Stein, 10t Metall und 100.000€. Es produziert 50 Strom und die Bauzeit beträgt 6 Minuten.', 25000, 10000, 100000, 0, 50, 0, 0, 0, 0, 6),
('Wohnhaus', 'Das Wohnhaus bietet Wohnraum für die Einwohner der Stadt. Es kostet 10t Stein, 5t Metall und 20.000€. Es verbraucht 10 Strom und die Bauzeit beträgt 3 Minuten. Es produziert 20.000€ und enthält 5 Einwohner.', 10000, 5000, 20000, 10, 0, 0, 0, 20000, 5, 3);
