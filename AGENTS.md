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
Stud.IP-Export, alte Zulassungsliste, Raumliste, Raumschema). Alle abgeleiteten Dateien
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
- **App-Shell mit fester Kopfzeile:** Die App ist genau so hoch wie der
  Viewport, gescrollt wird *innerhalb* des Screens. Drei Teile greifen
  ineinander und gehören zusammen geändert:
  1. `src/webLayout.ts` – hält `html`, `body` und `#root` auf Viewport-Höhe
     (`100dvh` wegen der ein-/ausblendenden Safari-Leisten auf iPad/iPhone)
     und lässt das Dokument nicht scrollen.
  2. `src/Router.tsx` – Kopfzeile als eigene Zeile (`flexShrink: 0`) über
     einem Inhaltsbereich mit `flex: 1, minHeight: 0`. Ohne `minHeight: 0`
     wächst der Bereich über seinen Anteil hinaus und nichts scrollt mehr.
  3. `ScreenContainer` – der `ScrollView` mit `flex: 1` ist der Scroller.
  Vorbild ist der Aufbau üblicher Expo-Apps (View `flex: 1` + ScrollView,
  Header außerhalb des ScrollViews), z. B. rocket-meals/score-tracker.
- Scrollen ist die fehleranfälligste Stelle dieser App und **von Hand zu
  prüfen** – am besten auf einem Touchgerät oder mit Geräte-Emulation. Der
  Maestro-Flow deckt es nicht zuverlässig ab: Vorher konnte man auf dem iPad
  gar nicht scrollen (Expos `body { overflow: hidden }` blockierte den
  Viewport), während `window.scrollTo` weiterhin wirkte und der Flow grün
  blieb. Umgekehrt scrollt jetzt nur noch der ScrollView – Werkzeuge, die
  das Fenster scrollen (`window.scrollBy`), bewegen nichts mehr; wer den
  Flow anpasst, prüft ihn danach komplett.
- Die App läuft vollständig lokal im Browser: Dateien per Dateiauswahl rein,
  Ergebnisse als Download raus. Kein Backend, kein Netzwerkzugriff mit
  Nutzdaten, keine Telemetrie. Diese Eigenschaft ist ein Feature – jede
  Abhängigkeit, die Daten nach außen gäbe, ist ausgeschlossen.
- Das Verhalten der Python-Skripte ist die fachliche Referenz; Abweichungen
  nur bewusst und dokumentiert.
- `apps/web/src/sampleData.ts` ist GENERIERT
  (`python3 tools/sync_sample_data_to_app.py`) – nie von Hand editieren.
  Jeder Screen bietet „Beispieldaten laden“ an; darauf baut der Maestro-Test.

## Projektordner (Startseite)

- `packages/core/src/projekt.ts` erkennt die Rolle einer Datei aus Name **und**
  Kopfzeile (`erkenneRolle`); die Kopfzeile hat Vorrang, weil Dateinamen in der
  Praxis uneinheitlich sind (`teilnehmer.csv` ist mal Stud.IP-Export, mal
  Teilnehmerliste). Neue Formate bekommen dort eine Regel **und** einen Test.
- `apps/web/src/projekt.tsx` hält den Stand im Speicher (React-Kontext):
  `datei(rolle)`/`dateienMit(rolle)` zum Lesen, `schreibe(name, text, rolle)`
  zum Zurückschreiben von Ergebnissen, `alsZip()` für den Download. Jeder
  Screen übernimmt Eingaben nur, solange dort noch nichts geladen ist – eine
  Auswahl von Hand wird nie überschrieben.
- Bewusst **kein** localStorage: Der Ordner enthält Personendaten, die nach dem
  Schließen der Seite nicht im Browserprofil zurückbleiben sollen. Ein Neuladen
  leert den Stand, das ist so gewollt und auf der Startseite erklärt.
- Der Browser darf nicht in den gewählten Ordner zurückschreiben; der Weg
  zurück auf die Platte ist immer die ZIP.

## Sitzplan im Raum (Screen 4)

- `packages/core/src/raumschema.ts` hält das Raster eines Raums (Tische, Tür,
  Wand, Pult) und die Drehung der Ansicht, `raumbelegung.ts` die Frage, wer an
  welchem Tisch sitzt (Reserveplätze, Vorgaben, Umsetzen).
- Zwei Regeln, an denen sich alles andere ausrichtet:
  1. **Die Sitzplatznummer gehört zum Tisch**, nicht zur Person – vergeben in
     Lesereihenfolge des gespeicherten Rasters, über alle Räume fortlaufend.
     Wer umgesetzt wird, bekommt die Nummer des neuen Tisches.
  2. **Gedreht wird nur die Ansicht.** `anzeigeRaster()` liefert Zellen, die
     ihre gespeicherte Position mitführen; Nummern und Belegung bleiben von
     der Blickrichtung unberührt.
- `verteileImRaum()` behält bestehende Plätze (auch ohne Vorgabe), damit ein
  Umbau des Raums manuelle Platzierungen nicht zunichtemacht. Für eine
  Verteilung von vorne vorher `ohneFreieBelegung()` anwenden.
- Wer im Screen die Belegung ändert, geht über `belegungSetzen()` – das setzt
  Verdrängte auf freie Tische nach und hält die Warnung „Ohne Tisch im
  Sitzplan“ aktuell.
- Ein „Element“ (Tischreihe, Wand) ist ein Rechteck gleicher Zellen: `Bereich`
  plus `fuelleBereich`/`bereichAendern`/`verschiebeBereich`. Dadurch bleibt die
  CSV ein Raster und lässt sich trotzdem wie in einer Tabellenkalkulation
  bedienen.

### Ziehen im Editor

- Gezogen wird mit Pointer-Events (`onPointerDown/Move/Up`), nicht mit
  Hover-Ereignissen: Beim Ziehen mit dem Finger fängt der Browser den Zeiger
  am Startelement ein, `onPointerEnter` anderer Zellen käme nie an. Welche
  Zelle gemeint ist, rechnet `Raumplan` deshalb aus den Koordinaten
  (`getBoundingClientRect` des Rasters, Zellgröße + Abstand); die Palette
  findet ihr Ziel über `document.elementFromPoint` und das `data-zelle` jeder
  Zelle (`datenAttribute()` in `src/domProps.ts`).
- Auf den ziehbaren Flächen steht `touch-action: none`, sonst scrollt die
  Seite mit, statt zu zeichnen.
- Schema und Belegung liegen im Screen zusätzlich in Refs
  (`schemataRef`/`belegungRef`) und werden über `uebernehmeSchemata()` bzw.
  `uebernehmeBelegung()` geschrieben. Beim Ziehen kommen viele Änderungen
  schnell hintereinander, und jede muss auf dem Ergebnis der vorherigen
  aufsetzen – der Zustand aus dem Render wäre dafür zu alt. Deshalb: in
  Ereignis-Handlern immer `.current` lesen, im Render den Zustand.

## PDF aus der sichtbaren Ansicht

`apps/web/src/print.ts` druckt den DOM-Knoten eines Views: klonen, die
Stylesheets der Seite mitgeben, als Blob-URL öffnen, `window.print()`. Die
PDF-Ausgabe ist damit genau das, was auf dem Bildschirm steht – kein zweites
Layout, das man mitpflegen müsste (Vorbild: Speiseplan-Druck von
rocket-meals). Für seitenweise Ausgabe `{...SEITENUMBRUCH}` an den View
hängen. Personenbezogene PDFs (Zulassung, Sitzplatz) entstehen weiterhin mit
pdf-lib in `packages/core/src/pdf.ts`, weil sie ohne Browser laufen müssen.

## Automatische Prüfungen

- `.github/workflows/test.yml` – Jest und Typecheck bei jedem Push und jedem
  Pull Request (auch auf `main`, damit das Banner in der README den Stand von
  main zeigt).
- `.github/workflows/deploy-web.yml` – Push auf `main`: Tests, Typecheck,
  Web-Export, GitHub Pages.
- `.github/workflows/data-clumps.yml` – Push auf `main`: Data-Clumps-Analyse
  mit dem data-clumps-doctor. Report und Badge liegen unter
  `reports/data-clumps-doctor/` und werden vom Workflow zurück nach `main`
  committet; das Badge in der README zeigt auf die Datei im Repo. Badge und
  Issue werden nur erneuert, wenn sich die Data Clumps geändert haben
  (`only-update-if-changes`), sonst gäbe es bei jedem Push ein neues Issue.
  Ein Push mit dem `GITHUB_TOKEN` startet keine weiteren Workflows – der
  Report-Commit löst also keine Schleife aus.
- Wer die Dateien unter `reports/` von Hand ändert, wird beim nächsten Lauf
  überschrieben; sie sind Ausgabe, keine Quelle.

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
