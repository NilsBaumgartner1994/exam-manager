# AGENTS.md

Arbeitsanweisungen für KI-Agenten und neue Mitwirkende. Fachlicher Kontext
steht in [README.md](README.md), der Prüfungsablauf in [WORKFLOW.md](WORKFLOW.md).

## Unverhandelbar: keine echten Personendaten

Dieses Repository ist öffentlich. Es enthält Prüfungsdaten-Strukturen, aber
niemals echte Personen.

- **Nie** echte Namen, Matrikelnummern, E-Mail-Adressen, Kennungen, Punktestände
  oder Prüfungsergebnisse hinzufügen – auch nicht in Beispielen, Kommentaren,
  Commit-Messages oder Issue-Texten.
- Echte Exporte gehören nach `_private/` (ignoriert) und werden nicht gelesen,
  wenn eine anonymisierte Alternative existiert.
- Werden echte Daten entdeckt: nicht in eine Antwort kopieren, sondern melden.
- **Löschen ist tabu:** Dateien mit echten Daten werden nicht gelöscht oder
  überschrieben, sondern nach `_private/` verschoben. Rückfragen, bevor etwas
  unwiederbringlich verschwindet.

## Beispieldaten ändern

Der Beispieldatensatz wird nicht von Hand gepflegt, sondern erzeugt:

```bash
python3 tools/generate_sample_data.py
```

Das Skript schreibt nur die **Eingangsdaten** (HIS-Export, VIPS-Notenliste,
Stud.IP-Export, alte Zulassungsliste, Raumliste). Alle abgeleiteten Dateien
entstehen, indem die Pipeline darüber läuft – die Befehlsfolge steht in der
README unter „Kompletter Durchlauf“. Wer den Datensatz ändert, führt sie
komplett aus und committet die neuen Ergebnisse.

Konventionen des Datensatzes:

- 10 Studierende, Vornamen alphabetisch A–J, berühmte Wissenschaftler:innen.
- Matrikelnummern fortlaufend ab `1000001`, E-Mail `<vorname>@test.de`.
- Lehrende/Tutor:innen stehen im Stud.IP-Export vorne und haben `Status`
  `dozent`/`tutor` sowie keine Matrikelnummer.
- Mindestens eine Person mit Umlaut im Namen (Schrödinger) – die UTF-8-Kette
  ist in der Praxis die häufigste Fehlerquelle.

## Datei- und Formatkonventionen

- CSV: Trennzeichen `;`, UTF-8, Zeilenende `\n`. Die VIPS-Notenliste hat als
  einzige Datei ein BOM – das entspricht dem echten Export und ist Absicht.
- Der Zulassungsbestand in `Zulassungen/` wird über den Dateinamen erkannt:
  nur `*zulassungen*.csv` zählt als Bestand.
- Dateinamen ohne Leerzeichen und Umlaute.
- Dokumentation und Skript-Ausgaben auf Deutsch, Code-Bezeichner Englisch oder
  Deutsch wie im umgebenden Code.

## Projektaufbau (TypeScript, Yarn Workspaces)

- Node 22 (`.nvmrc`, `nvm use`), Yarn 1 (classic). Installation: `yarn install`.
- `packages/core` – die Fachlogik als reines TypeScript, **ohne UI- oder
  Browser-Abhängigkeiten** (läuft im Browser und in Node; später auch in einem
  Node-Server einbindbar). Jede fachliche Funktion gehört hierher, nie in die
  App. Excel-/Datei-I/O bleibt draußen: Funktionen nehmen Strings bzw.
  Zellenmatrizen entgegen (siehe `hisExport.ts`).
- `apps/web` – Expo-Web-App (React Native Web; eigener Hash-Router in
  `src/Router.tsx`). Screens in `src/screens/`, wiederverwendbare Bausteine in
  `src/components/` (FilePickerButton, DataTable, LabeledInput, StatusText …)
  – neue UI zuerst aus diesen Bausteinen zusammensetzen, ggf. Bausteine
  erweitern.
- **Responsives Layout statt fester Breiten:** Maße kommen aus
  `src/responsive.ts` (`useResponsiveLayout()`), das Seitenrand, Abstände,
  Schriftgrößen, Formularbreiten und die Kachelspalten aus der Fensterbreite
  ableitet. Neue UI bekommt keine festen Pixelbreiten – prozentuale Breiten,
  `flexGrow`/`flexBasis` und Umbruch (`flexWrap`) verwenden; Pixelwerte nur
  als Umbruchgrenze (`flexBasis`, `minWidth`).
- Jeder Screen steckt über `ScreenContainer` in einem `ScrollView`, damit
  lange Seiten auch bei begrenzter Höhe scrollbar bleiben. Im Web ist `#root`
  weiterhin `height: auto` (siehe `App.tsx`), der ScrollView also nicht
  höhenbegrenzt – dort scrollt nach wie vor die Seite selbst, was normales
  Browser-Verhalten und Maestros `scrollUntilVisible` erhält. Wer das ändert
  (feste Höhe, sticky Header), muss den Maestro-Flow neu prüfen.
- Die App läuft vollständig lokal im Browser: Dateien per Dateiauswahl rein,
  Ergebnisse als Download raus. Kein Backend, kein Netzwerkzugriff mit
  Nutzdaten, keine Telemetrie. Diese Eigenschaft ist ein Feature – jede
  Abhängigkeit, die Daten nach außen gäbe, ist ausgeschlossen.
- Das Verhalten der Python-Skripte ist die fachliche Referenz; Abweichungen
  nur bewusst und dokumentiert.
- `apps/web/src/sampleData.ts` ist GENERIERT
  (`python3 tools/sync_sample_data_to_app.py`) – nie von Hand editieren.
  Jeder Screen bietet „Beispieldaten laden“ an; darauf baut der Maestro-Test.

## Änderungen prüfen

- `yarn test` – Jest-Tests der Fachlogik. Sie laufen gegen die Beispieldaten
  des Repos und prüfen die erwarteten Zahlen (6 neue Zulassungen, 9 mit
  Zulassung, 7 zugelassene Angemeldete, 1 ohne Zulassung, 7 Sitzplätze).
  Neue Fachlogik bekommt neue Tests in `packages/core/test/`.
- `yarn typecheck` – beide Pakete müssen sauber sein.
- E2E: `yarn web` starten, dann `maestro test .maestro/durchlauf.yaml`
  (siehe `.maestro/README.md`). Wer UI-Texte der Screens ändert, prüft den
  Flow – er asserted auf sichtbare Texte.
- Wer die Python-Referenz anfasst: kompletten Durchlauf aus der README
  ausführen und mit denselben Zahlen vergleichen; erzeugte PDF-Ordner
  (`pdfs/`, `studipKlausurzulassungPdfs/`) danach wieder entfernen.

## Datensatz oder Formate ändern

Reihenfolge: `python3 tools/generate_sample_data.py` → Pipeline aus der README
laufen lassen → `python3 tools/sync_sample_data_to_app.py` → `yarn test` (und
bei geänderten Zahlen die Tests, README und `.maestro/durchlauf.yaml`
anpassen).

## Bekannte Eigenheiten

- `checkPermissions.py` vergleicht zeilenweise mit `startswith` über
  `Nachname;Vorname;Matrikelnummer`. Schreibweisen müssen exakt übereinstimmen;
  eine Person mit geändertem Nachnamen wird nicht gefunden.
- Die Sortierung normalisiert Umlaute (`ä` → `ae`), damit sie der Reihenfolge
  in den Exporten entspricht.
- `createRoomAssignment.py` fragt den Verteilmodus interaktiv ab
  (`echo 2 | python3 …` für Skripte).
