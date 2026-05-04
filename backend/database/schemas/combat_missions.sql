/* Kampf-Missionen: Angriffe zwischen Spielern mit Reisezeit basierend auf Distanz
 *
 * Lebenszyklus einer Mission:
 *   traveling_to  → Einheiten reisen zur Basis des Verteidigers
 *   in_combat     → Kampfberechnung läuft (kurzlebig, wird im selben Tick aufgelöst)
 *   traveling_back → Überlebende Einheiten kehren zur Heimatbasis zurück
 *   completed     → Mission abgeschlossen, Einheiten zurück, Ergebnis gespeichert
 *   aborted       → Mission abgebrochen (z. B. keine Einheiten mehr vorhanden)
 */

CREATE TABLE IF NOT EXISTS combat_missions (
    id              SERIAL          PRIMARY KEY,

    -- Beteiligte Spieler
    attacker_id     BIGINT          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    defender_id     BIGINT          NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Status
    status          VARCHAR(20)     NOT NULL DEFAULT 'traveling_to'
                        CHECK (status IN ('traveling_to', 'in_combat', 'traveling_back', 'completed', 'aborted')),

    -- Koordinaten zum Zeitpunkt der Mission (werden gespeichert, da Spieler theoretisch verschiebbar wären)
    origin_x        INTEGER         NOT NULL,
    origin_y        INTEGER         NOT NULL,
    target_x        INTEGER         NOT NULL,
    target_y        INTEGER         NOT NULL,

    -- Vorberechnete Distanz (euklidisch, in Gittereinheiten)
    distance        DECIMAL(8, 2)   NOT NULL,

    -- Zeitplanung
    departure_time  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    arrival_time    TIMESTAMPTZ     NOT NULL,           -- Ankunft beim Verteidiger
    return_time     TIMESTAMPTZ,                        -- Rückkunft (wird nach Kampf gesetzt)

    -- Kampfergebnis (wird nach dem Kampf befüllt)
    result          JSONB,

    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- Welche Einheiten nehmen an der Mission teil
CREATE TABLE IF NOT EXISTS combat_mission_units (
    id                  SERIAL      PRIMARY KEY,
    mission_id          INTEGER     NOT NULL REFERENCES combat_missions(id) ON DELETE CASCADE,
    user_unit_id        INTEGER     NOT NULL REFERENCES user_units(id)      ON DELETE CASCADE,

    -- Gesendete Menge (kann kleiner sein als der gesamte Stack des Spielers)
    quantity_sent       INTEGER     NOT NULL CHECK (quantity_sent > 0),

    -- Zurückgekehrte Menge (NULL bis Mission abgeschlossen; Verluste reduzieren diesen Wert)
    quantity_returned   INTEGER     CHECK (quantity_returned >= 0)
);

-- Indizes für Tick-Abfragen (arriving/returning missions)
CREATE INDEX IF NOT EXISTS idx_combat_missions_attacker    ON combat_missions(attacker_id);
CREATE INDEX IF NOT EXISTS idx_combat_missions_defender    ON combat_missions(defender_id);
CREATE INDEX IF NOT EXISTS idx_combat_missions_arriving    ON combat_missions(status, arrival_time)
    WHERE status = 'traveling_to';
CREATE INDEX IF NOT EXISTS idx_combat_missions_returning   ON combat_missions(status, return_time)
    WHERE status = 'traveling_back';
CREATE INDEX IF NOT EXISTS idx_combat_mission_units_mission ON combat_mission_units(mission_id);
CREATE INDEX IF NOT EXISTS idx_combat_mission_units_unit    ON combat_mission_units(user_unit_id);
