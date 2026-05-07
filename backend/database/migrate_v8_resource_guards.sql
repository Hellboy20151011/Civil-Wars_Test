-- Migration v8: Ressourcenintegrität härten
--
-- Verhindert negative Bestände auf Datenbankebene für neue Updates/Inserte.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'user_resources_amount_non_negative'
    ) THEN
        ALTER TABLE user_resources
            ADD CONSTRAINT user_resources_amount_non_negative
            CHECK (amount >= 0) NOT VALID;
    END IF;
END $$;
