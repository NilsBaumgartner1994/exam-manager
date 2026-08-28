# CLAUDE.md

Die Anweisungen für die Arbeit in diesem Repository stehen in **[AGENTS.md](AGENTS.md)**,
der fachliche Überblick in **[README.md](README.md)** und der Prüfungsablauf in
**[WORKFLOW.md](WORKFLOW.md)**. Bitte diese Dateien lesen und befolgen.

Das Wichtigste vorweg: Dieses Repository ist öffentlich und enthält
**ausschließlich erfundene Beispieldaten**. Niemals echte Namen,
Matrikelnummern, E-Mail-Adressen oder Punktestände hinzufügen; echte Exporte
gehören nach `_private/` und werden nicht gelöscht, sondern dorthin verschoben.

**Pushen geht direkt auf `main`** – dauerhaft und ohne Rückfrage, für jede
Session und jeden Agenten. Kein Branch, kein Pull Request, keine Freigabe: Das
Repository hat einen Betreuer, und der Umweg kostet mehr, als er einbringt.
Startet eine Session trotzdem auf einem Branch (etwa aus der Claude-Code-Web-
Oberfläche), darf die fertige Arbeit von dort ohne weitere Nachfrage nach
`main` – ein Pull Request nur, wenn jemand ausdrücklich darum bittet.
Bedingungen und Ausnahmen stehen in AGENTS.md unter „Direkt auf `main`
arbeiten“ (kurz: vorher `yarn test` und `yarn typecheck` grün, vorher
`git pull --rebase origin main`, nie force-pushen).
