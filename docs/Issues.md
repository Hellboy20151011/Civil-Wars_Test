# Issues

_Aktualisiert: 2026-05-07_

## Aktuelle Punkte

- ✅ Bauwarteschlange ist jetzt seriell (Aufträge werden nacheinander ausgeführt, nicht parallel).
- ✅ Dashboard zeigt in der Bauwarteschlange nur den aktiven Auftrag; weitere Aufträge werden kompakt inkl. Abschlusszeit des letzten Auftrags angezeigt.
- ✅ Kraftwerk kann trotz negativer freier Strombilanz weiterhin gebaut werden (Power-Check nur für Gebäude mit Verbrauch > 0).
- ⚠️ Backend-Testlauf hat weiterhin 2 bekannte, bestehende Timer-Fails in `tests/services/gameloop-scheduler.test.js`.
