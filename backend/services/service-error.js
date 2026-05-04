/**
 * Erstellt einen typisierten Service-Fehler mit HTTP-Status und stabilem Code.
 *
 * @param {string} message - Fehlermeldung (kann dem Nutzer angezeigt werden)
 * @param {number} [status=400] - HTTP-Statuscode
 * @param {string} [code='REQUEST_ERROR'] - Stabiler Fehlercode für das Frontend
 * @returns {Error & { status: number, code: string }}
 *
 * ─── Fehlercode-Katalog ───────────────────────────────────────────────────────
 *
 * Auth
 *   AUTH_DUPLICATE_USER       400  Username oder E-Mail bereits vergeben
 *   AUTH_INVALID_CREDENTIALS  401  Ungültige Login-Daten
 *   AUTH_ACCOUNT_LOCKED       423  Account temporär gesperrt (zu viele Fehlversuche)
 *   AUTH_ACCOUNT_INACTIVE     403  Account deaktiviert
 *   AUTH_INVALID_REFRESH      401  Refresh-Token ungültig oder abgelaufen
 *   MAP_NO_FREE_SLOT          503  Kein freier Kartenplatz verfügbar
 *
 * Gebäude
 *   BUILDING_TYPE_NOT_FOUND   404  Gebäudetyp nicht in der Datenbank
 *   BUILDING_NOT_FOUND        404  Spielergebäude nicht gefunden
 *   BUILDING_MAX_LEVEL        400  Maximales Gebäudelevel bereits erreicht
 *   BUILDING_LEVEL_REQUIRED   400  Vorgänger-Level noch nicht gebaut
 *   BUILDING_PREREQUISITE     400  Voraussetzende Gebäudekette fehlt
 *   INSUFFICIENT_RESOURCES    400  Zu wenig Ressourcen
 *   INSUFFICIENT_POWER        400  Zu wenig Strom
 *   QUEUE_FULL                400  Bauqueue ist voll
 *   QUEUE_ITEM_NOT_FOUND      404  Queue-Eintrag nicht gefunden
 *
 * Einheiten
 *   UNIT_TYPE_NOT_FOUND       404  Einheitentyp nicht gefunden
 *   UNIT_NOT_FOUND            404  Einheit des Spielers nicht gefunden
 *   BUILDING_REQUIRED         400  Pflichtgebäude fehlt oder in Konstruktion
 *
 * Kampf
 *   NO_UNITS                  400  Keine Einheiten für Angriff ausgewählt
 *   SELF_ATTACK               400  Angriff auf eigene Basis
 *   ATTACKER_NOT_FOUND        404  Angreifer nicht gefunden
 *   DEFENDER_NOT_FOUND        404  Verteidiger nicht gefunden
 *   MISSING_COORDINATES       400  Zielkoordinaten fehlen
 *   UNIT_BUSY                 409  Einheit ist bereits im Einsatz
 *   INSUFFICIENT_UNITS        400  Zu wenig Einheiten vorhanden
 *   SAME_POSITION             400  Angreifer und Verteidiger an gleicher Position
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function createServiceError(message, status = 400, code = 'REQUEST_ERROR') {
    const error = new Error(message);
    error.status = status;
    error.code = code;
    return error;
}
