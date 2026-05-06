-- Migration v5: Forschungssystem

CREATE TABLE IF NOT EXISTS research_projects (
    id SERIAL PRIMARY KEY,
    code VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    required_research_lab_level INTEGER NOT NULL DEFAULT 1,
    required_project_id INTEGER REFERENCES research_projects(id) ON DELETE SET NULL,
    money_cost BIGINT NOT NULL DEFAULT 0,
    steel_cost BIGINT NOT NULL DEFAULT 0,
    fuel_cost BIGINT NOT NULL DEFAULT 0,
    duration_ticks DECIMAL(6,2) NOT NULL DEFAULT 1,
    unlock_category VARCHAR(100) NOT NULL,
    unlock_level INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_researches (
    id SERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id INTEGER NOT NULL REFERENCES research_projects(id) ON DELETE CASCADE,
    status VARCHAR(30) NOT NULL CHECK (status IN ('in_progress', 'completed')),
    started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ends_at TIMESTAMP NOT NULL,
    completed_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, project_id)
);

CREATE INDEX IF NOT EXISTS idx_user_researches_user_status
    ON user_researches(user_id, status);

INSERT INTO research_projects (
    code,
    name,
    description,
    required_research_lab_level,
    required_project_id,
    money_cost,
    steel_cost,
    fuel_cost,
    duration_ticks,
    unlock_category,
    unlock_level
)
VALUES
    (
        'DEFENSE_TECH_1',
        'Defensivdoktrin I',
        'Grundlagen stationaerer Verteidigung. Schaltet Verteidigungsstellungen der Stufe 1 frei.',
        1,
        NULL,
        120000,
        180,
        60,
        2,
        'defense',
        1
    ),
    (
        'DEFENSE_TECH_2',
        'Defensivdoktrin II',
        'Fortgeschrittene Stellungssysteme. Schaltet Verteidigungsstellungen der Stufe 2 frei.',
        2,
        1,
        320000,
        520,
        160,
        4,
        'defense',
        2
    ),
    (
        'DEFENSE_TECH_3',
        'Defensivdoktrin III',
        'Hochentwickelte Verteidigungssysteme. Schaltet Verteidigungsstellungen der Stufe 3 frei.',
        3,
        2,
        780000,
        1250,
        420,
        7,
        'defense',
        3
    )
ON CONFLICT (code) DO NOTHING;
