-- ============================================================
-- Migration v2 – Account-Lockout + Kampf-Missionen
-- Ausführen gegen eine bestehende civil_wars_test DB:
--   psql -U postgres -d civil_wars_test -f migrate_v2_combat.sql
-- ============================================================

-- 1. Account-Lockout-Spalten in users ergänzen
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS locked_until           TIMESTAMPTZ;

-- 2. Kampf-Missionen (aus schemas/combat_missions.sql)
CREATE TABLE IF NOT EXISTS combat_missions (
    id              SERIAL          PRIMARY KEY,
    attacker_id     BIGINT          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    defender_id     BIGINT          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status          VARCHAR(20)     NOT NULL DEFAULT 'traveling_to'
                        CHECK (status IN ('traveling_to', 'in_combat', 'traveling_back', 'completed', 'aborted')),
    origin_x        INTEGER         NOT NULL,
    origin_y        INTEGER         NOT NULL,
    target_x        INTEGER         NOT NULL,
    target_y        INTEGER         NOT NULL,
    distance        DECIMAL(8, 2)   NOT NULL,
    departure_time  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    arrival_time    TIMESTAMPTZ     NOT NULL,
    return_time     TIMESTAMPTZ,
    result          JSONB,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS combat_mission_units (
    id                  SERIAL      PRIMARY KEY,
    mission_id          INTEGER     NOT NULL REFERENCES combat_missions(id) ON DELETE CASCADE,
    user_unit_id        INTEGER     NOT NULL REFERENCES user_units(id)      ON DELETE CASCADE,
    quantity_sent       INTEGER     NOT NULL CHECK (quantity_sent > 0),
    quantity_returned   INTEGER     CHECK (quantity_returned >= 0)
);

CREATE INDEX IF NOT EXISTS idx_combat_missions_attacker    ON combat_missions(attacker_id);
CREATE INDEX IF NOT EXISTS idx_combat_missions_defender    ON combat_missions(defender_id);
CREATE INDEX IF NOT EXISTS idx_combat_missions_arriving    ON combat_missions(status, arrival_time)
    WHERE status = 'traveling_to';
CREATE INDEX IF NOT EXISTS idx_combat_missions_returning   ON combat_missions(status, return_time)
    WHERE status = 'traveling_back';
CREATE INDEX IF NOT EXISTS idx_combat_mission_units_mission ON combat_mission_units(mission_id);
CREATE INDEX IF NOT EXISTS idx_combat_mission_units_unit    ON combat_mission_units(user_unit_id);
