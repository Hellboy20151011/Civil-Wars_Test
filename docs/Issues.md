# Issues

## Websiteaufbau

- ❌ Navigationsleiste enthält nur Dashboard und Bauhof
- ✅ Im Bauhof Bereich (Bauhof.html) Kategorien vorhanden (Versorgungsgebäude, Unterkünfte, Militär, Regierungsgebäude, Verteidigung)
- ❌ Im Navigationsmenü eine neue verlinkung auf "Armee.html oder ähnlich" dort soll die Einheiten Ausbildung stattfinden.
- ❌ Ebenso dort in Kategorien Kaserne, Fahrzeugfabrik, Werft, Flughafen
- ❌ Navigationspunkt Verteidigung, dort die Verteidigungseinrichtungen wieder sortiert drin

## Resourcenproduktion

- ✅ Ressourcenproduktion läuft im Backend (gameloop-scheduler.js)
- ⚠️ Frontend Production-Panel existiert, aber ggf. nicht sichtbar (zu überprüfen)
- ✅ Energiebilanz funktioniert (mit korrekten Validierungen beim Bauen)

## Gebäudebau

- ✅ **Multi-Bau implementiert:** Textfeld für Gebäudeanzahl (1-999) pro Gebäude
- ✅ Backend validiert Strom- und Ressourcenlimits korrekt auch für Multi-Bau
- ✅ Fehlermeldungen wenn Limits nicht ausreichen
- ✅ Queue zeigt Countdown live nach jedem Build-Start
