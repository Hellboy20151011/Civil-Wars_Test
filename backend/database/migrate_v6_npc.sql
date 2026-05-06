-- Migration v6: NPC-Spieler-Support
-- Fügt NPC-Flag und Typ zur users-Tabelle hinzu

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS is_npc    BOOLEAN      NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS npc_type  VARCHAR(20)  NULL
        CHECK (npc_type IN ('defensive', 'aggressive'));

-- Index für schnellen NPC-Lookup im Gameloop
CREATE INDEX IF NOT EXISTS idx_users_is_npc ON users (is_npc) WHERE is_npc = TRUE;

-- NPCs brauchen keine echte E-Mail – Unique-Constraint nur für Non-NPCs
-- (email bleibt required, NPCs erhalten eine interne Pseudo-E-Mail)
