-- ============================================================
-- Civil-Wars Datenbank Setup
-- Frisches Schema – DB vorher leeren oder neu anlegen:
--   dropdb -U postgres civil_wars_test
--   createdb -U postgres civil_wars_test
--   psql -U postgres -d civil_wars_test -f setup.sql
-- ============================================================

-- 1. Benutzer (mit Weltkartenkoordinaten)
CREATE TABLE IF NOT EXISTS users (
    id                BIGSERIAL    PRIMARY KEY,
    email             VARCHAR(255) NOT NULL UNIQUE,
    username          VARCHAR(50)  NOT NULL UNIQUE,
    password_hash     TEXT         NOT NULL,
    role              VARCHAR(30)  NOT NULL DEFAULT 'player',
    is_active         BOOLEAN      NOT NULL DEFAULT TRUE,
    is_email_verified BOOLEAN      NOT NULL DEFAULT FALSE,
    koordinate_x      INTEGER,
    koordinate_y      INTEGER,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    last_login_at     TIMESTAMPTZ
);

-- 2. Ressourcen – flache Tabelle (eine Zeile pro Spieler, schneller als normalisiert)
CREATE TABLE IF NOT EXISTS user_resources (
    user_id              BIGINT      PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    geld                 BIGINT      NOT NULL DEFAULT 0 CHECK (geld >= 0),
    stein                BIGINT      NOT NULL DEFAULT 0 CHECK (stein >= 0),
    eisen                BIGINT      NOT NULL DEFAULT 0 CHECK (eisen >= 0),
    treibstoff           BIGINT      NOT NULL DEFAULT 0 CHECK (treibstoff >= 0),
    letzte_aktualisierung TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Gebäudetypen (mit Kategorie, Eisen- und Treibstoff-Spalten)
CREATE TABLE IF NOT EXISTS building_types (
    id                  SERIAL        PRIMARY KEY,
    name                VARCHAR(255)  NOT NULL UNIQUE,
    kategorie           VARCHAR(50)   NOT NULL DEFAULT 'Sonstige',
    description         TEXT,
    -- Kosten
    money_cost          BIGINT        NOT NULL DEFAULT 0,
    stone_cost          BIGINT        NOT NULL DEFAULT 0,
    iron_cost           BIGINT        NOT NULL DEFAULT 0,
    fuel_cost           BIGINT        NOT NULL DEFAULT 0,
    -- Strom
    power_consumption   INTEGER       NOT NULL DEFAULT 0,
    power_production    INTEGER       NOT NULL DEFAULT 0,
    -- Produktion pro Tick (1 Tick = 1 Minute)
    money_production    BIGINT        NOT NULL DEFAULT 0,
    stone_production    BIGINT        NOT NULL DEFAULT 0,
    iron_production     BIGINT        NOT NULL DEFAULT 0,
    fuel_production     BIGINT        NOT NULL DEFAULT 0,
    -- Sonstiges
    population          INTEGER       NOT NULL DEFAULT 0,
    build_time          INTEGER       NOT NULL DEFAULT 1  -- Minuten
);

INSERT INTO building_types
    (name, kategorie, description, money_cost, stone_cost, iron_cost, fuel_cost,
     power_consumption, power_production,
     money_production, stone_production, iron_production, fuel_production,
     population, build_time)
VALUES
    -- Regierung
    ('Rathaus',       'Regierung',  'Zentrales Verwaltungsgebäude. Keine Kosten.',          0,      0,     0,    0,  0,  0,    0,   0, 0, 0, 0,  1),
    -- Versorgung
    ('Kraftwerk',     'Versorgung', 'Produziert 50 Strom.',                                100000, 25000, 10000, 0,  0,  50,   0,   0, 0, 0, 0,  6),
    -- Unterkunft
    ('Wohnhaus',      'Unterkunft', 'Erzeugt Einwohner und produziert Geld.',               20000, 10000,  5000, 0, 10,  0, 2000, 0, 0, 0, 5,  3),
    -- Industrie
    ('Steinbruch',    'Industrie',  'Produziert Stein.',                                   15000,  5000,  2000, 0,  5,  0,    0, 500, 0, 0, 0,  4),
    ('Eisenmine',     'Industrie',  'Produziert Eisen.',                                   20000,  8000,  3000, 0,  8,  0,    0,   0, 200, 0, 0, 5),
    ('Ölförderturm',  'Industrie',  'Produziert Treibstoff.',                              25000, 10000,  5000, 0, 10,  0,    0,   0, 0, 100, 0, 6),
    -- Militär
    ('Kaserne',       'Militär',    'Erlaubt Ausbildung von Infanterie.',                  30000, 20000, 15000, 0, 15,  0,    0,   0, 0, 0, 0,  8)
ON CONFLICT (name) DO NOTHING;

-- 4. Gebäude des Spielers (Anzahl-basiert – mehrere Gebäude gleichen Typs möglich)
CREATE TABLE IF NOT EXISTS user_buildings (
    id               SERIAL   PRIMARY KEY,
    user_id          BIGINT   NOT NULL REFERENCES users(id)          ON DELETE CASCADE,
    building_type_id INTEGER  NOT NULL REFERENCES building_types(id) ON DELETE CASCADE,
    anzahl           INTEGER  NOT NULL DEFAULT 1 CHECK (anzahl > 0),
    UNIQUE (user_id, building_type_id)
);

-- 5. Bauwarteschlange (getrennt von fertigen Gebäuden)
CREATE TABLE IF NOT EXISTS bau_auftraege (
    id               SERIAL      PRIMARY KEY,
    user_id          BIGINT      NOT NULL REFERENCES users(id)          ON DELETE CASCADE,
    building_type_id INTEGER     NOT NULL REFERENCES building_types(id) ON DELETE CASCADE,
    anzahl           INTEGER     NOT NULL DEFAULT 1 CHECK (anzahl > 0),
    fertig_am        TIMESTAMPTZ NOT NULL,
    erstellt_am      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Kaserne-Stufen (für späteres Militär-System)
CREATE TABLE IF NOT EXISTS kaserne_stufen (
    stufe       INTEGER PRIMARY KEY,
    kosten_geld BIGINT  NOT NULL,
    kosten_stein BIGINT NOT NULL,
    kosten_eisen BIGINT NOT NULL,
    max_einheiten INTEGER NOT NULL
);

INSERT INTO kaserne_stufen (stufe, kosten_geld, kosten_stein, kosten_eisen, max_einheiten) VALUES
    (1,        0,      0,     0,  50),
    (2,  50000, 20000, 10000, 150),
    (3, 150000, 60000, 30000, 400),
    (4, 500000,200000,100000,1000)
ON CONFLICT (stufe) DO NOTHING;
