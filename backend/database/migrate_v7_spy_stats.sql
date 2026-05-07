-- Migration v7: Spionage-Angriff- und Abwehr-Statistiken für Einheiten
--
-- Fügt spy_attack und spy_defense zu unit_types hinzu.
-- Das neue System ersetzt den level-basierten Erfolgsformel-Ansatz:
--   Gesamtangriff  = SUM(spy_attack  * quantity_sent)  aller gesendeten Spione
--   Gesamtabwehr   = SUM(spy_defense * quantity)        aller intel-Einheiten des Verteidigers
--
-- Verhältnis-Stufen:
--   ratio < 1.10  → Fehlschlag  (alle Spione verloren, Verteidiger benachrichtigt)
--   1.10 – 1.30   → Stufe 1    (raubbare Gebäude grob + Abwehr ±5%)
--   1.30 – 1.65   → Stufe 2    (Produktionsgebäude exakt + Einheiten/Verteidigung Gesamtzahl)
--   > 1.65        → Stufe 3    (vollständige Auflistung, Verteidiger NICHT benachrichtigt)

-- 1. Spalten hinzufügen
ALTER TABLE unit_types
    ADD COLUMN IF NOT EXISTS spy_attack  INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS spy_defense INTEGER NOT NULL DEFAULT 0;

-- 2. Werte für Intel-Einheiten setzen
UPDATE unit_types SET spy_attack = 20,  spy_defense = 30, hitpoints = 0 WHERE name = 'Spion';
UPDATE unit_types SET spy_attack = 50,  spy_defense = 45, hitpoints = 0 WHERE name = 'SR-71 Aufklärer';
UPDATE unit_types SET spy_attack = 150, spy_defense = 20, hitpoints = 0 WHERE name = 'Spionagesatellit';
