# Maestro-E2E-Test

Kompletter Durchlauf durch alle vier Screens der Web-App – jeweils mit den
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
