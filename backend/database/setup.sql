-- ============================================================
-- Civil-Wars Datenbank Setup
-- Reihenfolge beachten: resource_types vor user_resources
-- ============================================================

-- 1. Benutzer
CREATE TABLE IF NOT EXISTS users (
    id                BIGSERIAL    PRIMARY KEY,
    email             VARCHAR(255) NOT NULL UNIQUE,
    username          VARCHAR(50)  NOT NULL UNIQUE,
    password_hash     TEXT         NOT NULL,
    role              VARCHAR(30)  NOT NULL DEFAULT 'player',
    is_active         BOOLEAN      NOT NULL DEFAULT TRUE,
    is_email_verified BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    last_login_at     TIMESTAMPTZ
);

-- 2. Ressourcentypen
CREATE TABLE IF NOT EXISTS resource_types (
    id   SERIAL       PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE
);

INSERT INTO resource_types (name) VALUES
    ('Stein'),
    ('Metall'),
    ('Geld')
ON CONFLICT (name) DO NOTHING;

-- 3. Benutzerressourcen
CREATE TABLE IF NOT EXISTS user_resources (
    id               SERIAL  PRIMARY KEY,
    user_id          BIGINT  NOT NULL REFERENCES users(id)          ON DELETE CASCADE,
    resource_type_id INTEGER NOT NULL REFERENCES resource_types(id) ON DELETE CASCADE,
    amount           INTEGER NOT NULL DEFAULT 0 CHECK (amount >= 0),
    UNIQUE (user_id, resource_type_id)
);

-- 4. Gebäudetypen
CREATE TABLE IF NOT EXISTS building_types (
    id                 SERIAL        PRIMARY KEY,
    name               VARCHAR(255)  NOT NULL UNIQUE,
    description        TEXT,
    stone_cost         INTEGER       NOT NULL DEFAULT 0,
    metal_cost         INTEGER       NOT NULL DEFAULT 0,
    money_cost         INTEGER       NOT NULL DEFAULT 0,
    power_consumption  INTEGER       NOT NULL DEFAULT 0,
    power_production   INTEGER       NOT NULL DEFAULT 0,
    stone_production   INTEGER       NOT NULL DEFAULT 0,
    metal_production   INTEGER       NOT NULL DEFAULT 0,
    money_production   INTEGER       NOT NULL DEFAULT 0,
    population         INTEGER       NOT NULL DEFAULT 0,
    build_time         INTEGER       NOT NULL DEFAULT 1  -- Minuten
);

-- Unique-Constraint nachrüsten falls Tabelle aus altem Schema stammt
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'building_types_name_key'
          AND conrelid = 'building_types'::regclass
    ) THEN
        ALTER TABLE building_types ADD CONSTRAINT building_types_name_key UNIQUE (name);
    END IF;
END $$;

INSERT INTO building_types
    (name, description, stone_cost, metal_cost, money_cost, power_consumption, power_production, stone_production, metal_production, money_production, population, build_time)
VALUES
    ('Rathaus',  'Zentrales Verwaltungsgebäude. Keine Baukosten, Bauzeit 1 Minute.',  0,     0,     0,      0,  0,  0, 0,     0, 0, 1),
    ('Kraftwerk','Produziert Strom. Bauzeit 6 Minuten.',                              25000, 10000, 100000, 0,  50, 0, 0,     0, 0, 6),
    ('Wohnhaus', 'Wohnraum für Einwohner, produziert Geld. Bauzeit 3 Minuten.',       10000, 5000,  20000,  10, 0,  0, 0, 20000, 5, 3)
ON CONFLICT (name) DO NOTHING;

-- 5. Benutzergebäude
CREATE TABLE IF NOT EXISTS user_buildings (
    id                      SERIAL      PRIMARY KEY,
    user_id                 BIGINT      NOT NULL REFERENCES users(id)          ON DELETE CASCADE,
    building_type_id        INTEGER     NOT NULL REFERENCES building_types(id) ON DELETE CASCADE,
    level                   INTEGER     NOT NULL DEFAULT 1,
    status                  VARCHAR(20) NOT NULL DEFAULT 'in_progress'
                                        CHECK (status IN ('in_progress', 'complete')),
    construction_start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    construction_end_time   TIMESTAMPTZ NOT NULL,
    UNIQUE (user_id, building_type_id)
);
