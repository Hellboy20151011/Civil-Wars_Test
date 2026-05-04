-- Migration: Spionagesystem hinzufügen
-- Erstellt die Tabellen spy_missions und spy_mission_units,
-- fügt intel-Einheiten (Spion, SR-71 Aufklärer, Spionagesatellit) hinzu
-- und erweitert unit_types um die 'intel'-Kategorie.

-- 1. Neue Einheitenkategorie ist bereits in der CHECK-Constraint nicht beschränkt,
--    daher können die Einheiten direkt eingefügt werden.

INSERT INTO unit_types (name, category, building_requirement, description, money_cost, steel_cost, fuel_cost, training_time_ticks, hitpoints, attack_points, defense_points, movement_speed, special_ability, counter_unit)
VALUES
    ('Spion', 'intel', 'Geheimdienstzentrum Level 1',
     'Verdeckter Agent für Aufklärung und Informationsbeschaffung. Höhere Anzahl erhöht Erfolgswahrscheinlichkeit.',
     50000, 0, 80, 2, 60, 0, 5, 5, 'Spionage, Tarnung', NULL),
    ('SR-71 Aufklärer', 'intel', 'Geheimdienstzentrum Level 2',
     'Hochgeschwindigkeits-Aufklärungsjet für schnelle weitreichende Informationsbeschaffung.',
     320000, 180, 650, 4, 80, 0, 8, 12, 'Schnelle Spionage, Luftaufklärung (Reichweite 20)', NULL),
    ('Spionagesatellit', 'intel', 'Geheimdienstzentrum Level 3',
     'Orbitales Aufklärungssystem mit nahezu garantierter Erfolgsrate.',
     1200000, 500, 1200, 8, 100, 0, 12, 20, 'Vollständige Aufklärung, kaum abfangbar', NULL)
ON CONFLICT (name) DO NOTHING;

-- 2. Spionage-Missions-Tabellen anlegen
CREATE TABLE IF NOT EXISTS spy_missions (
    id              SERIAL          PRIMARY KEY,
    spy_id          BIGINT          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_id       BIGINT          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status          VARCHAR(20)     NOT NULL DEFAULT 'traveling_to'
                        CHECK (status IN ('traveling_to', 'spying', 'traveling_back', 'completed', 'aborted')),
    origin_x        INTEGER         NOT NULL,
    origin_y        INTEGER         NOT NULL,
    target_x        INTEGER         NOT NULL,
    target_y        INTEGER         NOT NULL,
    distance        DECIMAL(8, 2)   NOT NULL,
    spies_sent      INTEGER         NOT NULL CHECK (spies_sent > 0),
    spies_returned  INTEGER,
    departure_time  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    arrival_time    TIMESTAMPTZ     NOT NULL,
    return_time     TIMESTAMPTZ,
    report          JSONB,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS spy_mission_units (
    id                SERIAL  PRIMARY KEY,
    mission_id        INTEGER NOT NULL REFERENCES spy_missions(id) ON DELETE CASCADE,
    user_unit_id      INTEGER NOT NULL REFERENCES user_units(id)   ON DELETE CASCADE,
    quantity_sent     INTEGER NOT NULL CHECK (quantity_sent > 0),
    quantity_returned INTEGER CHECK (quantity_returned >= 0)
);

CREATE INDEX IF NOT EXISTS idx_spy_missions_spy       ON spy_missions(spy_id);
CREATE INDEX IF NOT EXISTS idx_spy_missions_target    ON spy_missions(target_id);
CREATE INDEX IF NOT EXISTS idx_spy_missions_arriving  ON spy_missions(status, arrival_time)
    WHERE status = 'traveling_to';
CREATE INDEX IF NOT EXISTS idx_spy_missions_returning ON spy_missions(status, return_time)
    WHERE status = 'traveling_back';
CREATE INDEX IF NOT EXISTS idx_spy_mission_units      ON spy_mission_units(mission_id);
