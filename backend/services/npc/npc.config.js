/**
 * NPC KI – alle Spielkonstanten
 *
 * Alle Zahlenwerte die das NPC-Verhalten steuern sind hier zentralisiert.
 * Änderungen hier wirken sich auf Gebäudebau, Einheitentraining und Kampf aus.
 */

// ── Militär ───────────────────────────────────────────────────────────────────

/** Mindestanzahl Einheiten damit ein Angriff startet. */
export const MIN_ATTACK_UNITS = 5;

/** Maximale stehende Armee – oberhalb wird kein Training mehr gestartet. */
export const MAX_STANDING_ARMY = 50;

/** Anteil der verfügbaren Einheiten der pro Angriff entsendet wird (50 %). */
export const MAX_ATTACK_RATIO = 0.5;

/** Mindestpause zwischen zwei Angriffen desselben NPCs (12 Stunden). */
export const NPC_ATTACK_COOLDOWN_MS = 12 * 60 * 60 * 1_000;

// ── Energie ───────────────────────────────────────────────────────────────────

/**
 * Unterhalb dieser freien Energie baut der NPC zuerst ein Kraftwerk.
 * Wert 5 = kleinster Stromverbrauch eines geplanten Gebäudes (Wohnhaus).
 */
export const MIN_USEFUL_FREE_POWER = 5;

// ── Produktionsraten pro Gebäude (Werte aus building_types.sql) ───────────────

export const STEIN_PER_STEINBRUCH      = 10; // t Stein pro Tick
export const STAHL_PER_STAHLWERK       =  7; // t Stahl pro Tick
export const TREIBSTOFF_PER_RAFFINERIE = 10; // L Treibstoff pro Tick

// ── Produktionsziele für Phase 2 ─────────────────────────────────────────────
//   500t Stein/Tick  → 50 Steinbrüche
//   350t Stahl/Tick  → 50 Stahlwerke
//   500L Treibstoff  → 50 Öl-Raffinerien + 10 Ölpumpen

export const STEIN_PRODUCTION_TARGET      = 500; // t/Tick
export const STAHL_PRODUCTION_TARGET      = 350; // t/Tick
export const TREIBSTOFF_PRODUCTION_TARGET = 500; // L/Tick

/** Maximale Öl-Raffinerien pro Ölpumpe (Verhältnisregel). */
export const RAFFINERIEN_PRO_PUMPE = 5;
