# Maestro-E2E-Test

Kompletter Durchlauf durch alle fünf Screens der Web-App – jeweils mit den
eingebauten Beispieldaten (Datei-Uploads lassen sich im Browser nicht
automatisieren, deshalb hat jeder Screen den Button „Beispieldaten laden“).

## Ausführen

```bash
# Terminal 1: Web-App starten
yarn web    # läuft auf http://localhost:8081

# Terminal 2: Maestro-Flow (nutzt Chromium)
maestro test .maestro/durchlauf.yaml
```

Maestro installieren: https://maestro.mobile.dev („Web-Support“ ist als
Beta enthalten; `maestro test` erkennt am `url:`-Feld, dass ein Browser
gestartet werden soll).

## Scrollen im Web

Die App scrollt seit dem App-Shell-Umbau nicht mehr das Dokument, sondern den
`ScrollView` des Screens (feste Kopfzeile, siehe `AGENTS.md`). Fensterweites
Scrollen (`window.scrollBy`) bewegt deshalb nichts mehr; `scrollIntoView` auf
ein Element und echte Wisch-/Mausradgesten funktionieren. Sollte
`scrollUntilVisible` in diesem Flow hängen bleiben, liegt es daran – dann den
Schritt auf `swipe` umstellen (die Elemente selbst sind unverändert).
