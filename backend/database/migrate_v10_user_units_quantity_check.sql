-- V10: Schützt user_units.quantity auf DB-Ebene gegen negative Werte

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'user_units_quantity_non_negative'
    ) THEN
        ALTER TABLE user_units
        ADD CONSTRAINT user_units_quantity_non_negative CHECK (quantity >= 0);
    END IF;
END $$;
