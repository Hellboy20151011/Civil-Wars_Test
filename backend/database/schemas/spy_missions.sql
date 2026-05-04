/* Spionage-Missionen: Geheimdienst-Einsätze zwischen Spielern
 *
 * Lebenszyklus:
 *   traveling_to   → Spione reisen zum Ziel
 *   spying         → Spionage läuft (kurzlebig, wird im selben Tick aufgelöst)
 *   traveling_back → Überlebende Spione kehren zurück
 *   completed      → Mission abgeschlossen, Bericht vorhanden
 *   aborted        → Mission gescheitert (alle Spione erwischt)
 *
 * Erfolgsberechnung (im Service):
 *   base_success_rate = 50% + 10% * geheimdienstzentrum_level (Angreifer)
 *                       - 15% * gegenspionage_level (Verteidiger)
 *   clamp: 10% … 95%
 *   Pro Spion +5% (bis max 95%).
 *   Jeder Spion wird einzeln geprüft – Berichte werden nur von erfolgreichen Spionen erstellt.
 */

CREATE TABLE IF NOT EXISTS spy_missions (
    id              SERIAL          PRIMARY KEY,

    -- Beteiligte Spieler
    spy_id          BIGINT          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_id       BIGINT          NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Status
    status          VARCHAR(20)     NOT NULL DEFAULT 'traveling_to'
                        CHECK (status IN ('traveling_to', 'spying', 'traveling_back', 'completed', 'aborted')),

    -- Koordinaten zum Zeitpunkt der Mission
    origin_x        INTEGER         NOT NULL,
    origin_y        INTEGER         NOT NULL,
    target_x        INTEGER         NOT NULL,
    target_y        INTEGER         NOT NULL,

    -- Distanz (euklidisch)
    distance        DECIMAL(8, 2)   NOT NULL,

    -- Anzahl gesendeter / zurückgekehrter Spione
    spies_sent      INTEGER         NOT NULL CHECK (spies_sent > 0),
    spies_returned  INTEGER,                               -- NULL bis completed

    -- Zeitplanung
    departure_time  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    arrival_time    TIMESTAMPTZ     NOT NULL,
    return_time     TIMESTAMPTZ,

    -- Spionage-Bericht (JSONB – wird nach Ankunft befüllt)
    -- Struktur bei Erfolg:
    --   { success: true,  targetUsername, spiesCaught, buildings: {...}, units: {...}, defenses: [...] }
    -- Struktur bei Misserfolg:
    --   { success: false, targetUsername, spiesCaught }
    report          JSONB,

    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- user_unit_id der gesendeten Spion-Einheit (für Reservierung wie bei Kampf)
CREATE TABLE IF NOT EXISTS spy_mission_units (
    id              SERIAL  PRIMARY KEY,
    mission_id      INTEGER NOT NULL REFERENCES spy_missions(id) ON DELETE CASCADE,
    user_unit_id    INTEGER NOT NULL REFERENCES user_units(id)   ON DELETE CASCADE,
    quantity_sent   INTEGER NOT NULL CHECK (quantity_sent > 0),
    quantity_returned INTEGER CHECK (quantity_returned >= 0)
);

-- Indizes für Tick-Abfragen
CREATE INDEX IF NOT EXISTS idx_spy_missions_spy        ON spy_missions(spy_id);
CREATE INDEX IF NOT EXISTS idx_spy_missions_target     ON spy_missions(target_id);
CREATE INDEX IF NOT EXISTS idx_spy_missions_arriving   ON spy_missions(status, arrival_time)
    WHERE status = 'traveling_to';
CREATE INDEX IF NOT EXISTS idx_spy_missions_returning  ON spy_missions(status, return_time)
    WHERE status = 'traveling_back';
CREATE INDEX IF NOT EXISTS idx_spy_mission_units       ON spy_mission_units(mission_id);
