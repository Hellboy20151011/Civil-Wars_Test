# Contributing to Civil Wars

Danke für dein Interesse, zum Projekt beizutragen!

---

## Voraussetzungen

| Tool | Mindestversion |
|------|---------------|
| Node.js | 18 |
| PostgreSQL | 14 |
| Git | beliebig |

---

## Lokales Setup

```bash
git clone https://github.com/Hellboy20151011/Civil-Wars_Test.git
cd Civil-Wars_Test/backend
cp .env.example .env   # .env anpassen
npm install
node scripts/resetdb.js
npm run dev
```

Alternativ mit Docker:

```bash
docker compose up
```

---

## Branch-Konvention

| Präfix | Verwendung |
|--------|-----------|
| `feature/` | Neues Feature |
| `fix/` | Bug Fix |
| `refactor/` | Refactoring ohne Funktionsänderung |
| `docs/` | Nur Dokumentation |
| `chore/` | Tooling, CI, Abhängigkeiten |

Beispiel: `git checkout -b feature/kampfsystem`

---

## Commit-Style

Wir folgen [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <Kurzbeschreibung>

[optionaler Body]
```

Typen: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `ci`

Beispiele:
```
feat(buildings): Gebäude-Upgrade-Route hinzufügen
fix(auth): JWT-Ablaufzeit bei Login korrekt setzen
docs(readme): Docker-Quickstart ergänzen
```

---

## Semantic Versioning (Team-Regel)

Wir versionieren Releases nach [SemVer](https://semver.org/lang/de/): `MAJOR.MINOR.PATCH`.

| Typ | Wann erhöhen? | Beispiele |
|-----|----------------|-----------|
| MAJOR | Inkompatible API-Änderung (Breaking Change) | Feldname/Response-Struktur geändert, Route entfernt oder Verhalten nicht rückwärtskompatibel |
| MINOR | Neues rückwärtskompatibles Feature | Neue Route, neue optionale Response-Felder, neue Spielmechanik ohne bestehende Clients zu brechen |
| PATCH | Rückwärtskompatibler Fix/Docs/Refactor | Bugfix, Sicherheitsfix ohne API-Bruch, reine Doku- oder interne Refactor-Änderung |

Zusätzliche Regeln:
- Bei Breaking Changes muss der PR-Titel den Hinweis `BREAKING CHANGE` enthalten.
- Jede Version wird als Git-Tag `vX.Y.Z` veröffentlicht (z. B. `v1.2.0`).
- Die Änderung wird immer im `CHANGELOG.md` unter `[Unreleased]` dokumentiert.

---

## Pull Requests

1. Branch von `main` erstellen.
2. Änderungen committen (Conventional Commits).
3. Lint und Tests lokal prüfen:
   ```bash
   npm run lint
   npm test
   ```
4. PR gegen `main` öffnen – das PR-Template vollständig ausfüllen.
5. Mindestens 1 Review abwarten.

---

## Branch-Schutz-Regeln (einmalige Admin-Einrichtung)

Diese Regeln müssen von einem Repository-Admin unter
**Settings → Branches → Branch protection rules** für `main` aktiviert werden:

| Einstellung | Wert |
|-------------|------|
| Require a pull request before merging | ✔ aktiv |
| Required approvals | 1 |
| Require status checks to pass before merging | ✔ aktiv |
| Required status checks | `Lint & Test (Backend)`, `Build (Frontend)`, `Lint (Frontend)` |
| Do not allow bypassing the above settings | ✔ aktiv |
| Allow force pushes | ✘ deaktiviert |
| Allow deletions | ✘ deaktiviert |

---

## Code-Stil

- ESLint + Prettier: `npm run lint` / `npm run format`
- Alle Fehler in Routen via `next(err)` weitergeben (kein direktes `res.json` für Serverfehler).
- Neue DB-Abfragen gehören in `backend/repositories/`, nicht in Services.
- Keine Secrets oder `.env`-Dateien committen.

---

## Tests

```bash
npm test                   # alle Tests
npx vitest run --coverage  # mit Coverage-Report
```

Neue Features brauchen Unit-Tests in `backend/tests/`.

---

## Issues

Bugs → Bug-Report-Template verwenden.  
Features → Feature-Request-Template verwenden.
