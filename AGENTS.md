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

`tools/build_sample_project.py` baut daraus `Beispielprojekt/` – den
Beispiel-Projektordner der Web-App.

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
  nur `*zulassungen*.csv` zählt als Bestand. Im Projektordner der App gilt das
  zusätzlich zum Ordner selbst (siehe „Projektordner“).
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

- `packages/core/src/projekt.ts` beschreibt den Ordner als Schema
  (`PROJEKT_SCHEMA`): je Regel ein Ordner, die zulässigen Endungen, optional
  ein Namensbestandteil und die Rollen, die dort vorkommen. Daraus leiten sich
  `PROJEKT_ORDNER` (Rolle → Ordner), `erkenneRolle`, `projektPfad` und die
  Projektvorlage ab – **eine Quelle**, kein zweiter Ort, an dem Ordnernamen
  stehen. Ein neues Format bekommt dort eine Regel **und** einen Test.
- **Der Ordner entscheidet, nicht der Dateiname.** `erkenneRolle` gibt
  `unbekannt` zurück, sobald eine Datei außerhalb ihres Ordners liegt oder die
  Endung nicht passt – eine Notenliste im Hauptordner wird nicht ausgewertet.
  Das ist Absicht: In der Praxis heißen Exporte uneinheitlich, und die falsche
  Datei stillschweigend auszuwerten ist schlimmer, als eine sichtbar zu
  ignorieren. Die Kopfzeile entscheidet nur noch dort, wo ein Ordner mehrere
  Rollen aufnimmt (`Raeume/`: Raumliste oder Raumschema).
- Der Aufbau folgt den Schritten der App: `0_Input_…` für alles, was von außen
  kommt (Prüfungsamt, Stud.IP, VIPS), nummerierte Export-Ordner für die
  Ergebnisse der Schritte. `Zulassungen/` und `Raeume/` bleiben unnummeriert,
  weil sie über eine einzelne Klausur hinaus gelten; die Raumraster liegen
  dort blanko, damit sie sich jedes Jahr wiederverwenden lassen.
- `apps/web/src/projekt.tsx` hält den Stand im Speicher (React-Kontext):
  `datei(rolle)`/`dateienMit(rolle)` zum Lesen, `schreibe(name, inhalt, rolle)`
  zum Zurückschreiben von Ergebnissen (der Zielordner kommt aus dem Schema),
  `ersetze(rolle, dateien)` zum Leeren-und-neu-Füllen eines Ordners (die
  Zulassungs-PDFs: alte Stände dürfen nicht stehenbleiben) und `alsZip()` für
  den Download. Gelesen und mitgeführt wird **jede** Datei des Ordners, auch
  eine nicht zugeordnete: Die ZIP ersetzt den Ordner auf der Platte und darf
  nichts verlieren. Jeder Screen übernimmt Eingaben nur, solange dort noch
  nichts geladen ist – eine Auswahl von Hand wird nie überschrieben.
- Der Download-Knopf steht als `ProjektDownload` in `src/components/` und
  gehört auf **jeden** Screen; ein neuer Screen bekommt ihn mit.
- `ProjektQuelle` gehört unter **jede** Dateiauswahl, deren Eingabe auch aus
  dem Projekt kommen kann: Sie nennt die Datei, die der Schritt von dort
  standardmäßig nimmt (bei mehreren Kandidaten die erste alphabetisch, und
  welche dadurch liegen bleiben) oder sagt, dass im erwarteten Ordner nichts
  liegt. Ohne diese Zeile ist von außen nicht zu sehen, woher die Zahlen
  stammen.
- Bewusst **kein** localStorage: Der Ordner enthält Personendaten, die nach dem
  Schließen der Seite nicht im Browserprofil zurückbleiben sollen. Ein Neuladen
  leert den Stand, das ist so gewollt und auf der Startseite erklärt.
- Der Browser darf nicht in den gewählten Ordner zurückschreiben; der Weg
  zurück auf die Platte ist immer die ZIP.
- `Beispielprojekt/` im Repo ist ein gefüllter Projektordner zum Ausprobieren.
  Er wird nicht von Hand gepflegt, sondern erzeugt:
  `python3 tools/build_sample_project.py`. Wer das Schema ändert, ändert dort
  die Zielpfade mit – `packages/core/test/projekt.test.ts` prüft, dass jede
  Datei im Beispielprojekt von `erkenneRolle` wiedergefunden wird.

## Räume: zwei Screens, ein Editor

- Räume und ihre leeren Raster gehören zu **keiner** einzelnen Klausur: Im
  Projektordner liegen sie in `Raeume/`, außerhalb der nummerierten
  Schritt-Ordner. Screen 5 (`RaeumeScreen`) bearbeitet sie für sich, Screen 4
  legt die Belegung darüber.
- Damit beide dasselbe tun, liegt das Bearbeiten in Bausteinen und nicht in
  einem der Screens: `components/RaumListe.tsx` (die Raumliste als Formular)
  und `components/RaumplanEditor.tsx` (`useRaumplanEditor` mit Werkzeug,
  Auswahl, Ansicht, Verlauf und Drehung, dazu `RaumPalette`, `PlanLeiste`,
  `RaumplanKarte`, `RaumplanFlaeche`).
- Was die beiden Screens unterscheidet, steckt allein in der Anbindung
  `aendere`: Screen 4 zieht dort die Belegung nach (und beim Verschieben eines
  Blocks die Personen darin mit), Screen 5 schreibt nur das Schema. Wer eine
  neue Bearbeitungsfunktion baut, baut sie in den Baustein – sonst kann sie
  einer der beiden Screens nicht.
- `aendereOhneBelegung` ist kein Schönheitsfehler: Am Text eines Feldes hängt
  keine Belegung, und sonst liefe bei jedem Tastendruck die Verteilung über
  alle Räume neu.
- **Rückgängig/Wiederholen liegt auch im Baustein**, und zwar als
  Momentaufnahme des ganzen Standes (`PlanZustand`): Der Screen gibt
  `zustand`/`setzeZustand` mit, Screen 4 nimmt die Belegung dazu – Raster und
  Belegung gehören zusammen, einzeln zurückgesetzt stünde hinterher das eine
  ohne das andere. Wer im Screen etwas am Plan ändert, das nicht durch ein
  Werkzeug des Editors läuft (Platzieren, Reserve, Vorgabe, Raster anlegen
  oder entfernen), ruft vorher `editor.merkeStand()` – sonst führt ein
  Rückgängig weiter zurück, als der Nutzer erwartet. Innerhalb eines Zugs
  fasst eine `marke` zusammen, was ein Schritt ist (ein Malzug über viele
  Zellen, alles Getippte in ein Textfeld); beendet wird er von `zugBeendet`,
  das `Raumplan` beim Loslassen meldet.

## Sitzplan im Raum (Screen 4)

- `packages/core/src/raumschema.ts` hält das Raster eines Raums (Tische, Tür,
  Wand, Pult) und die Drehung der Ansicht, `raumbelegung.ts` die Frage, wer an
  welchem Tisch sitzt (Reserveplätze, Vorgaben, Umsetzen).
- **`tisch` und `pult` sind beides Tische**, der Unterschied ist der Zweck:
  `tisch` ist ein Sitzplatz (wird nummeriert und belegt, `tischzellen()`
  zählt ihn), `pult` ein Tisch ohne Sitzplatz. In der Oberfläche heißen sie
  deshalb „Sitzplatz“ und „Pult“ und sind in zwei Holztönen gezeichnet –
  gleiche Familie, unterschiedliche Helligkeit.
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
- **Freier Text liegt neben dem Raster, nicht darin:** `Beschriftung` ist ein
  Bereich mit Text (`verbindeZellen`/`trenneZellen`/`setzeBeschriftungsText`)
  und steht in eigenen CSV-Zeilen `Text;<Zeile>;<Spalte>;<Höhe>;<Breite>;<Text>`.
  So bleibt das Raster ein Rechteck aus Ein-Zeichen-Kürzeln und der Text darf
  beliebig lang sein. Ein Feld legt sich **über** das Raster, statt es zu
  ersetzen: Die Zellen darunter bleiben, damit sich auch eine Tür
  („Haupteingang“) oder eine Tischreihe („Aufsicht“) beschriften lässt.
  Deshalb ist das Feld beim Bearbeiten nur halb deckend und zeigt sonst allein
  seinen Text auf heller Unterlage. Weg ist es mit `trenneZellen` oder dem
  Radierer – nur `fuelleBereich(..., 'leer')` nimmt Textfelder mit.
- **Adressen wie in Excel:** `spaltenName` (A, B, …, AA), `zeilenName` (ab 1),
  `bereichName` (`B3:E7`). Die Köpfe beschriften die *gedrehte* Ansicht; was
  über dem Raster liegt (Auswahl, Textfelder), rechnet `anzeigeBereich` mit
  derselben Drehung um wie `anzeigeRaster`.
- **Die Zellgröße ist nicht fest:** `rastermasse()` in `Raumplan.tsx` passt
  Zellen, Abstand, Kopfgröße und Schriftgrößen an Fenster und Raumgröße an.
  Drei Ansichten (`PlanAnsicht`): `breite` (Voreinstellung – die volle Breite
  wird genutzt, in die Höhe wird gescrollt), `einpassen` (auch ein Hörsaal mit
  47 × 34 Feldern am Stück auf einem 1920 × 1080-Schirm) und `frei`
  (Zellgröße in Pixeln, wie das Zoomen in ein Bild; der erste Zoomschritt
  setzt auf der gerade gezeichneten Größe auf, die `onZellGroesse` meldet).
  Zellgröße und Fuge hängen voneinander ab – erst schätzen, dann mit der
  passenden Fuge rechnen, sonst bleibt bei 47 Spalten ein Streifen ungenutzt.
  Bei so vielen Zellen zählt jede Neuberechnung: Die
  Zellen sind `React.memo` und bekommen deshalb stabile Rückrufe (Position als
  Argument statt frisch erzeugter Closure) und gemerkte Werte (`useMemo` für
  Raster und Belegungskarte).

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

Diese PDFs benutzen die eingebaute Helvetica, und die kann nur WinAnsi
(CP1252) – Umlaute und ß ja, `ź`, `ł` oder Kyrillisch nein. pdf-lib bricht
sonst mit „WinAnsi cannot encode …“ ab, und zwar mitten im Stapel: Ein
einziger Name kostet dann alle PDFs. `winAnsiText()` schreibt solche Zeichen
deshalb um – erst den Akzent abtrennen (`ź` → `z`), dann die Tabelle `ERSATZ`
(`ł` → `l`), zuletzt `?`. Wer die Zeichenliste anfasst, hat den Test „schreibt
jedes Zeichen, das es durchlässt, auch wirklich ins PDF“ als Kontrolle: Er
jagt jedes Zeichen bis U+201F durch pdf-lib. Die Screens melden über
`nichtDarstellbareZeichen()`, welche Namen betroffen sind – ein Name, der im
PDF anders steht als in der Liste, darf nicht stillschweigend passieren.

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
laufen lassen → `python3 tools/build_sample_project.py` →
`python3 tools/sync_sample_data_to_app.py` → `yarn test` (und bei geänderten
Zahlen die Tests, README und `.maestro/durchlauf.yaml` anpassen).

## Bekannte Eigenheiten

- `checkPermissions.py` vergleicht zeilenweise mit `startswith` über
  `Nachname;Vorname;Matrikelnummer`. Schreibweisen müssen exakt übereinstimmen;
  eine Person mit geändertem Nachnamen wird nicht gefunden.
- Die Sortierung normalisiert Umlaute (`ä` → `ae`), damit sie der Reihenfolge
  in den Exporten entspricht.
- `createRoomAssignment.py` fragt den Verteilmodus interaktiv ab
  (`echo 2 | python3 …` für Skripte).
