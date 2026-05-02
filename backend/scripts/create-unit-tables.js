import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432'),
});

const sql = `
    CREATE TABLE IF NOT EXISTS unit_types (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        category VARCHAR(100) NOT NULL,
        building_requirement VARCHAR(255) NOT NULL,
        description TEXT,
        money_cost INTEGER NOT NULL DEFAULT 0,
        steel_cost INTEGER NOT NULL DEFAULT 0,
        fuel_cost INTEGER NOT NULL DEFAULT 0,
        training_time_ticks DECIMAL(4,2) NOT NULL DEFAULT 1,
        hitpoints INTEGER NOT NULL DEFAULT 100,
        attack_points INTEGER NOT NULL DEFAULT 10,
        defense_points INTEGER NOT NULL DEFAULT 5,
        movement_speed DECIMAL(4,2) NOT NULL DEFAULT 3,
        special_ability VARCHAR(255),
        counter_unit VARCHAR(255)
    );

    CREATE TABLE IF NOT EXISTS user_units (
        id SERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        unit_type_id INTEGER NOT NULL REFERENCES unit_types(id) ON DELETE CASCADE,
        quantity INTEGER DEFAULT 0,
        location_x INTEGER DEFAULT 0,
        location_y INTEGER DEFAULT 0,
        is_moving BOOLEAN DEFAULT FALSE,
        destination_x INTEGER,
        destination_y INTEGER,
        arrival_time TIMESTAMPTZ,
        health_percentage INTEGER DEFAULT 100,
        experience_points INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
    );

    INSERT INTO unit_types (name, category, building_requirement, description, money_cost, steel_cost, fuel_cost, training_time_ticks, hitpoints, attack_points, defense_points, movement_speed, special_ability) VALUES
    ('Soldat',        'infantry', 'Kaserne',    'Rückgrat der Armee.',                   10000,   15,   25, 0.5,  70,  7, 15, 3.0, 'Frontlinie-Angriff'),
    ('Pionier',       'infantry', 'Kaserne',    'Spezialist für Befestigungen.',          25000,   30,   50, 1.0,  90,  5, 20, 2.0, 'Befestigungen bauen'),
    ('Jeep',          'vehicle',  'Kaserne',    'Leichtes Aufklärungsfahrzeug.',          15000,   40,   80, 0.5,  50,  4,  8, 6.0, 'Schnelle Aufklärung'),
    ('Kampfpanzer',   'vehicle',  'Kaserne',    'Schwerer gepanzerter Kampfwagen.',      120000,  350,  500, 3.0, 250, 25, 40, 3.0, 'Panzerung verstärkt'),
    ('Torpedoboot',   'ship',     'Kaserne',    'Schnelles Kriegsschiff.',                50000,  100,  150, 1.0,  80, 12, 10, 5.0, 'Torpedoangriff'),
    ('Kampfhubschrauber', 'air',  'Kaserne',    'Bewaffneter Hubschrauber.',              80000,   60,  200, 1.0,  60, 15, 12, 6.0, 'Bodenunterstützung')
    ON CONFLICT (name) DO NOTHING;
`;

await pool.query(sql);
console.log('unit_types und user_units erstellt + Basisdaten eingefügt');
await pool.end();
