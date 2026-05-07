-- Migration v9: TIMESTAMP → TIMESTAMPTZ für alle relevanten Zeitspalten
-- Stellt konsistente Zeitzonenbehandlung sicher.
-- Bestehende Werte werden in UTC interpretiert und als TIMESTAMPTZ gespeichert.

-- building_types
ALTER TABLE building_types
    ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';

-- unit_types
ALTER TABLE unit_types
    ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';

-- research_projects
ALTER TABLE research_projects
    ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';

-- user_researches
ALTER TABLE user_researches
    ALTER COLUMN started_at    TYPE TIMESTAMPTZ USING started_at    AT TIME ZONE 'UTC',
    ALTER COLUMN ends_at       TYPE TIMESTAMPTZ USING ends_at       AT TIME ZONE 'UTC',
    ALTER COLUMN completed_at  TYPE TIMESTAMPTZ USING completed_at  AT TIME ZONE 'UTC',
    ALTER COLUMN created_at    TYPE TIMESTAMPTZ USING created_at    AT TIME ZONE 'UTC',
    ALTER COLUMN updated_at    TYPE TIMESTAMPTZ USING updated_at    AT TIME ZONE 'UTC';

-- user_buildings
ALTER TABLE user_buildings
    ALTER COLUMN construction_start_time TYPE TIMESTAMPTZ USING construction_start_time AT TIME ZONE 'UTC',
    ALTER COLUMN construction_end_time   TYPE TIMESTAMPTZ USING construction_end_time   AT TIME ZONE 'UTC',
    ALTER COLUMN created_at              TYPE TIMESTAMPTZ USING created_at              AT TIME ZONE 'UTC',
    ALTER COLUMN updated_at              TYPE TIMESTAMPTZ USING updated_at              AT TIME ZONE 'UTC';

-- user_resources
ALTER TABLE user_resources
    ALTER COLUMN last_updated TYPE TIMESTAMPTZ USING last_updated AT TIME ZONE 'UTC';

-- user_units
ALTER TABLE user_units
    ALTER COLUMN arrival_time TYPE TIMESTAMPTZ USING arrival_time AT TIME ZONE 'UTC',
    ALTER COLUMN created_at   TYPE TIMESTAMPTZ USING created_at   AT TIME ZONE 'UTC',
    ALTER COLUMN updated_at   TYPE TIMESTAMPTZ USING updated_at   AT TIME ZONE 'UTC';
