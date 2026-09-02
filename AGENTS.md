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
Stud.IP-Export, alte Zulassungsliste, Raumliste, Raumraster – je Raum eine
Datei in `.../2_raum_zuteilung_erstellen/raumschema/`). Alle abgeleiteten Dateien
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
- `packages/cli` – dieselben fünf Schritte auf der Kommandozeile
  (`yarn 1_vips …` bis `yarn 5_raeume …`). Dünn: Argumente lesen, Dateien
  einlesen, Core rufen, Ergebnis schreiben – **keine** Fachlogik, die die App
  nicht auch hätte. Ein neuer Screen bekommt einen Befehl, ein neuer Schalter
  eine Zeile in seiner `BefehlBeschreibung`; daraus entstehen Prüfung **und**
  Hilfetext, damit beide nicht auseinanderlaufen. Fehlt etwas im Aufruf, wird
  `FehlendeAngabe` geworfen: Der Aufrufer sieht die Hilfe des Befehls und
  darunter den Satz, was fehlt – auf der Kommandozeile ist die Hilfe das, was
  in der App das Formular ist. Relative Pfade meinen das Verzeichnis, in dem
  getippt wurde (`INIT_CWD`), nicht das Wurzelverzeichnis des Workspaces.
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
- **Modals sind eine Ebene der App, kein zweites Fenster.** `ModalProvider`
  (`src/components/ModalHost.tsx`, um die ganze App in `App.tsx`) legt über den
  Screens eine absolut positionierte Ebene an; `useModalEbene(inhalt)` zeichnet
  ein Blatt dort hinein (`createPortal` in ihren DOM-Knoten – im React-Baum
  bleibt es bei dem Screen, der es öffnet, samt Kontext). Vorbild ist der
  `ModalProvider`/`ModalRenderer` von rocket-meals. **Kein `Modal` aus React
  Native**: Das hängt sich im Web als eigenes `div` an den `body` – außerhalb
  von `#root` und damit außerhalb der App-Shell –, und dann scrollt wieder der
  Browser die Seite, statt der ScrollView des Screens. Wer ein neues Modal
  baut, nimmt `BlattModal` oder wenigstens `useModalEbene`.
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
  Rollen aufnimmt (`4_Raumzuteilung_Export/`: Sitzplan, Belegung oder die
  Räume dieser Klausur). `Vorlagen/` nimmt nur `*vorlage*.md` auf – die
  LIESMICH daneben bleibt „nicht zugeordnet“, und eine alte
  `Raeume/raeume.csv` (Kopfzeile `Raum;Plätze;…`) ebenfalls: Als Raster
  gelesen ergäbe sie einen Raum namens „Plätze“.
- Der Aufbau folgt den Schritten der App: `0_Input_…` für alles, was von außen
  kommt (Prüfungsamt, Stud.IP, VIPS), nummerierte Export-Ordner für die
  Ergebnisse der Schritte. `Zulassungen/` und `Raeume/` bleiben unnummeriert,
  weil sie über eine einzelne Klausur hinaus gelten; die Raumraster liegen
  dort blanko, damit sie sich jedes Jahr wiederverwenden lassen.
- **In `Raeume/` liegt je Raum eine Raster-Datei**, benannt nach dem Raum
  (`raumschemaDateiname`: `94/E01` → `94_E01.csv`). So ist am Ordner zu sehen,
  welche Räume es gibt, und ein einzelner Raum lässt sich austauschen, ohne die
  anderen anzufassen. Gelesen werden immer **alle** Raster-Dateien des Ordners
  (`dateienMit('raumschema')` → `parseRaumschemaDateien`), geschrieben wird mit
  `ersetze('raumschema', raumschemaDateien(...))` – sonst bliebe die Datei
  eines entfernten Rasters liegen. Eine alte Sammeldatei mit mehreren Räumen
  bleibt lesbar; steht ein Raum doppelt, zählt der erste.
- `apps/web/src/projekt.tsx` hält den Stand im Speicher (React-Kontext):
  `datei(rolle)`/`dateienMit(rolle)` zum Lesen, `schreibe(name, inhalt, rolle)`
  zum Zurückschreiben von Ergebnissen (der Zielordner kommt aus dem Schema),
  `ersetze(rolle, dateien)` zum Leeren-und-neu-Füllen eines Ordners (die
  Zulassungs-PDFs: alte Stände dürfen nicht stehenbleiben) und `alsZip()` für
  den Download. Gelesen und mitgeführt wird **jede** Datei des Ordners, auch
  eine nicht zugeordnete: Die ZIP ersetzt den Ordner auf der Platte und darf
  nichts verlieren. Jeder Screen übernimmt Eingaben nur, solange dort noch
  nichts geladen ist – eine Auswahl von Hand wird nie überschrieben.
- **Ein Zwischen-Export darf entbehrlich sein, aber nicht stillschweigend
  übergangen werden:** Schritt 4 braucht `3_Klausur_Teilnehmende_Export/`
  nicht. Fehlt die Teilnehmerliste, prüft er die Anmeldungen aus
  `0_Input_Klausuranmeldungen/` selbst gegen den Zulassungsbestand
  (`pruefeAnmeldungen` im Core). Sind alle zugelassen, übernimmt er sie
  wortlos; ist jemand ohne Zulassung dabei, steht die Rückfrage **oben** im
  Screen und der Nutzer entscheidet (nur die Zugelassenen, trotzdem alle, oder
  eigene CSV). Wer eine solche Abkürzung baut, macht die Herkunft der Zahlen
  über `ProjektQuelle` sichtbar und fragt bei jeder Abweichung nach, statt sie
  wegzurechnen.
- **Die Startseite beginnt mit dem Projekt**, nicht mit den Schritten: Kurs,
  geladener Ordner, „Projektordner öffnen“ und „Aktuelles Projekt
  herunterladen“ stehen über den fünf Kacheln. Alles Weitere hängt daran – wer
  den falschen Ordner geladen hat, soll es sehen, ohne zu scrollen. Die
  Ordner-Tabelle („was gehört wohin“) steht in der README und in der
  `LIESMICH.md` der Vorlage, nicht mehr auf der Startseite; die erkannten
  Dateien liegen dort hinter „Dateien anzeigen“.
- **Der Kursname steht in keiner Datei.** Stud.IP legt ihn nur in den Namen
  des Teilnehmendenexports; `kursAusDateiname` (Core, `studip.ts`) übersetzt
  ihn zurück (`Teilnehmendenexport_Software_Engineering.csv` → „Software
  Engineering“), `projekt.kurs` hält ihn für die App bereit. Passt nichts,
  bleibt er `null` – lieber kein Kurs als ein geratener. Schritt 1 belegt
  damit den „Name der Veranstaltung“ vor, in der Schreibweise für Dateinamen
  (`veranstaltungAlsKennung`: Leerzeichen → `_`), solange dort nichts getippt
  wurde.
- Der Download-Knopf steht als `ProjektDownload` in `src/components/` und
  gehört auf **jeden** Screen; ein neuer Screen bekommt ihn mit (in den
  Arbeitsflächen der Schritte 4 und 5 als Menüeintrag,
  `useProjektDownloadEintrag`).
- `ProjektQuelle` gehört unter **jede** Dateiauswahl, deren Eingabe auch aus
  dem Projekt kommen kann: Sie nennt die Datei, die der Schritt von dort
  standardmäßig nimmt (bei mehreren Kandidaten die erste alphabetisch, und
  welche dadurch liegen bleiben) oder sagt, dass im erwarteten Ordner nichts
  liegt. Ohne diese Zeile ist von außen nicht zu sehen, woher die Zahlen
  stammen.
- **Der Stand liegt im `localStorage`** (`src/projektSpeicher.ts`): Ein
  Neuladen soll nichts kosten, und jede Änderung eines Screens wandert
  gebündelt mit hinein. Ein neuer Ordner räumt vorher auf (`ladeOrdner`:
  erst `loescheStand`, dann lesen) – zwei Klausuren dürfen sich nie mischen;
  Datei-Uploads einzelner Screens fassen den Stand nicht an. Das sind
  Personendaten: Sie bleiben im Browserprofil, bis „Projekt schließen“ sie
  entfernt – die Startseite sagt das dazu, und wer daran etwas ändert, lässt
  den Hinweis stehen. `localStorage` fasst nur wenige Megabyte und nur Text:
  Binärdateien stehen Base64-kodiert darin und fliegen bei Platznot zuerst
  heraus; **was fehlt, meldet `speicher`** und die Startseite schreibt es hin
  (ein stiller Verlust beim nächsten Öffnen wäre die schlechtere Überraschung).
- Was ein Screen nur bei sich hält (eine geladene CSV, die noch nirgends
  hingeschrieben wurde), überlebt das Neuladen **nicht** – gesichert ist, was
  im Projektstand steht. Screen 5 schreibt die Raster deshalb von
  selbst dorthin (gebündelt, 400 ms); wer eine ähnliche Bearbeitung baut,
  macht es genauso, statt auf einen Knopf zu warten.
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
- **Der Bestand ist der Ordner, die Benutzung eine Liste.** Welche Räume es
  gibt, sagt `Raeume/` selbst – je Raum eine Raster-Datei;
  `4_Raumzuteilung_Export/klausurraeume.csv` (Rolle `klausurraeume`,
  `Raum;ReservierteZeit`) sagt, welche davon **diese** Klausur benutzt. Dort
  darf derselbe Raum mehrfach stehen: Dann wird er mehrfach belegt (Gruppe 1
  vormittags, Gruppe 2 nachmittags). Der wievielte Einsatz das ist, steht
  nicht in der Datei – `parseRaeume` zählt die Wiederholungen beim Einlesen
  durch (`Raum.durchgang`), die Reihenfolge der Zeilen ist also
  bedeutungstragend.
- **Die Platzzahl wird nirgends gespeichert.** Sie sind die Tische im Raster
  (`plaetzeJeRaum`, `Raum` hat kein Feld `plaetze`): Wer im Plan einen Tisch
  setzt oder entfernt, ändert damit die Plätze des Raums. Eine mitgeschriebene
  Zahl daneben wäre nach dem ersten Umbau falsch, und niemand könnte sagen,
  welche der beiden gilt – deshalb gibt es `Raeume/raeume.csv` nicht mehr.
  Eine ältere Datei mit einer Spalte `Plätze` bleibt lesbar, die Spalte wird
  überlesen. Wer eine Verteilung rechnet, gibt die Plätze als Map mit
  (`erstelleRaumzuteilung(..., { plaetze })`); ein Raum ohne Raster hat keine
  und bleibt leer, statt geraten zu werden.
- **Vor dem Verteilen steht die Frage, ob es reicht** (`pruefePlatzbedarf`):
  Teilnehmende, die maximale Zahl der Plätze, wie viele frei bleiben oder
  fehlen und welche Räume kein Raster haben. Schritt 4 zeigt das über der
  Raumliste (`PlatzBedarf`), die Kommandozeile bricht damit ab
  (`--trotzdem` verteilt dennoch). Vorher fiel erst nach dem Verteilen auf,
  dass Leute übrig bleiben.
- **Was am Raum hängt und was am Durchgang:** Das Raster gehört zum Raum (ein
  Umbau gilt für beide Durchgänge), Belegung und Sitzplatznummern gehören zum
  Durchgang. Angesprochen wird ein Einsatz über `raumSchluessel(raum)` –
  `01/E01` bzw. `01/E01 (2. Durchgang)`. Der Schlüssel steht in
  `Platzbelegung.raum`, in `Sitzplatz.raumSchluessel` und als Name der Raster
  aus `einsatzRaster(raeume, schemata)`; `Sitzplatz.raum` bleibt der Raumname,
  denn der steht auf Aushang und PDF. Wer im Screen etwas an der Belegung tut,
  nimmt den Schlüssel; wer am Raster arbeitet, den Raumnamen (`RaumplanBuehne`
  bekommt beides: `schema` den Raum, `schluessel` den Einsatz).
- **Beide Screens sind Arbeitsflächen, kein scrollendes Formular.**
  `components/Arbeitsflaeche.tsx` gibt den Aufbau einer Tabellenkalkulation
  vor: `Arbeitsflaeche` (Menüband oben, Körper, Fußleiste unten) und
  `Reiterinhalt` (ein Reiter, dessen Inhalt ein Formular ist und für sich
  scrollt). Die `Arbeitsflaeche` misst ihren Körper (`onLayout`) und gibt die
  Höhe als `children(hoehe)` weiter – ohne die Zahl kann „Ganzer Raum“ nicht
  rechnen. Ein Vollbild-Modus wäre danach überflüssig: Der Screen **ist** das
  Vollbild.
- **Das Menüband ist eine Menüleiste, keine Knopfreihe** (`Menueband.tsx`,
  `Menueleiste`): eine Zeile mit „Datei“, „PDF“, „Werkzeuge“, „Anzeigen“,
  „Räume“ – jedes klappt auf, wie in Word oder Excel. Über dreißig Knöpfe in
  vier Zeilen nahmen dem Plan den halben Bildschirm. Ein Screen beschreibt
  seine Menüs als **Daten** (`MenuGruppe`/`MenuEintrag`: `aktion`, `schalter`,
  `datei`, `ziehbar`, `trenner`), nicht als Bausteine – daraus wird am Rechner
  ein herunterklappendes Menü und auf dem Handy (`isCompact`) eine Schublade
  hinter dem Burger-Zeichen, mit zwei Ebenen und „Zurück“. Zwei Darstellungen
  aus zwei Sätzen Knöpfe zu bauen hieße, jede Aktion zweimal hinzuschreiben.
  Wer eine Aktion hinzufügt, hängt sie in ein Menü; nur was **immer** sichtbar
  sein muss (Zoom, Stand), gehört in die Fußleiste.
  - Gezeichnet wird in die Modal-Ebene (`ModalHost`), sonst läge das Menü
    hinter dem Arbeitsbereich – beide sind Geschwister, der spätere gewinnt.
  - **Kein Deckel über dem Bildschirm zum Zuklappen:** Geschlossen wird über
    einen `pointerdown` am Dokument. Eine Fläche über allem verdeckte den Plan
    und finge das Ablegen eines Elements aus der Palette ab.
  - Ein Element der Palette (`ziehbar`) lässt sich aus dem offenen Menü auf
    eine Zelle ziehen. Währenddessen nimmt das Menü keine Zeiger mehr an
    (`pointerEvents`), damit `document.elementFromPoint` die Zelle darunter
    findet – wer daran etwas ändert, probiert genau das aus.
  - Was gerade gilt, steht als `wert` hinter dem Namen („Räume 94/E01“,
    „Werkzeuge Sitzplatz“) und auf dem Handy neben dem Burger: In einer
    Knopfreihe war es die hervorgehobene Kachel, im zugeklappten Menü sähe man
    es sonst nicht.
- **Ein Plan zur Zeit, umgeschaltet im Menü „Räume“.** Schritt 5 hat dort die
  Raumliste plus einen Eintrag je Raum, Schritt 4 „Einstellungen“, „Listen“
  und je einen pro Raum**einsatz** (Schlüssel = `raumSchluessel`). Die beiden
  festen Einträge tragen ein `#` im Schlüssel, damit sie nie mit einem
  Raumnamen kollidieren. Gezeigt wird immer **ein** Plan (`RaumplanBuehne`);
  fünf Pläne nebeneinander, darunter ein Hörsaal mit 44 × 32 Feldern, sind
  weder zu überblicken noch flüssig zu zeichnen.
- **Der Raumplan als PDF entsteht mit `sitzplaenePdf()`** – in Schritt 4 mit
  Belegung (alle Räume in einer Datei, je Einsatz eine Seite), in Schritt 5
  ohne (der gezeigte Raum als eigene Datei, benannt nach `raumDateiname`).
  Eine zweite Zeichenroutine für den leeren Grundriss gibt es nicht.
- **Ein Raum *ist* sein Raster.** Anlegen, Duplizieren, Umbenennen und
  Löschen in Schritt 5 fassen genau eine Datei in `Raeume/` an – eine Liste
  daneben, die mitgepflegt werden müsste, gibt es nicht. Der Name wird dabei
  **nicht getippt**, sondern umbenannt: Er ist der Dateiname des Rasters, und
  ein halb getippter Name legte je Tastendruck eine Datei an. Kopiert wird mit
  `kopiereRaumschema` (Core) – eine echte Kopie, sonst änderte ein Strich im
  Duplikat auch das Original. Zwei Räume mit demselben Namen lässt die App
  nicht zu: Der Name ist der Dateiname.
- **Die Bestandsliste ist der Bestand, kein Formular daneben.** Schritt 5
  zeigt sie als `components/RaumBestandListe.tsx`: je Raum ein Kasten mit den
  Sitzplätzen seines Rasters und den Vorgängen, die ihn betreffen („Plan
  bearbeiten“, „Umbenennen …“, „Duplizieren …“, „Entfernen“). Eingabefelder
  gibt es dort keine mehr – die Plätze stehen im Raster, und die reservierte
  Zeit gehört zur Klausur, nicht zum Haus. Die Klausur-Liste aus Schritt 4
  (`components/RaumListe.tsx`) ist das Gegenstück: Dort sind Zeilen
  **Einsätze**, derselbe Raum darf mehrfach vorkommen, getippt wird nur die
  reservierte Zeit, und die Plätze stehen als Auskunft daneben.
- **Namen werden gefragt, nicht geraten.** Anlegen, Duplizieren, Umbenennen
  und Löschen laufen über ein Blatt (`RaumVorgangBlatt`, ein `RaumVorgang`) –
  kein „Raum 3“, der hinterher auf dem Aushang steht, und vor dem Löschen eine
  Rückfrage. Die Vorgänge stehen im Menü „Räume“ **und** an jeder Zeile der
  Bestandsliste: Wer den Bestand pflegt, ist mal im Plan und mal in der Liste.
- **Screen 5 zeigt genau einen Raum** – den aus dem Menü „Räume“. Gespeichert
  werden weiterhin alle Räume. Speichern, Laden und PDF liegen im Menü
  „Datei“, wie das Dateimenü einer Tabellenkalkulation, nicht in einer Section
  am Seitenende.
- **Das neutrale Werkzeug ist die Voreinstellung.** Der `zeiger` ändert
  nichts: Ein Klick öffnet das `ZellInfoBlatt` (Art der Zelle,
  Sitzplatznummer, wer dort sitzt, der Text darüber), ein Ziehen schiebt den
  Ausschnitt. So schreibt der erste Klick in einen Plan nie versehentlich
  einen Tisch. Zeichnen tut nur, wer vorher ein Element wählt – die
  Reihenfolge einer Tabellenkalkulation. `aendertNichts()` sammelt die
  Werkzeuge, die das Raster nicht anfassen (`zeiger`, `auswahl`, `hand`);
  `planWerkzeug()` bildet sie auf `PlanWerkzeug` ab.
- **Das Info-Blatt ändert nur den Text.** Es ist die Antwort auf „was ist das
  hier?“ und zugleich der Weg, den Text einer Stelle zu schreiben
  (`textfeldAnlegen` legt eines über eine einzelne Zelle). Alles andere ändert
  ein Element aus der Palette – ein Nachschlagen soll den Raum nicht umbauen.
- Damit beide dasselbe tun, liegt das Bearbeiten in Bausteinen und nicht in
  einem der Screens: `components/RaumListe.tsx` (die Räume einer Klausur als
  Formular), `components/RaumBestandListe.tsx` (der Bestand des Hauses samt
  Rastern) und `components/RaumplanEditor.tsx` (`useRaumplanEditor` mit Werkzeug,
  Auswahl, Ansicht, Verlauf und Drehung, dazu `paletteEintraege` und
  `rasterEintraege` fürs Menü „Werkzeuge“, `RaumplanBuehne` für den Plan selbst
  und `PlanFuss` für die Fußleiste). Voreingestellt ist „Ganzer Raum“
  (`PLAN_ANSICHT_EDITOR`): Auf einer Fläche, die den Bildschirm füllt, passt
  der Raum hinein – eine erzwungene Scrollliste braucht dort niemand.
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
- **`tisch`, `reserve` und `pult` sind alle drei Tische**, der Unterschied ist
  der Zweck: `tisch` ist ein Sitzplatz (wird nummeriert und belegt,
  `tischzellen()` zählt ihn), `reserve` ein Tisch, der in diesem Raum dauerhaft
  frei bleibt (`reservezellen()`, keine Nummer, keine Belegung), `pult` ein
  Tisch ohne Sitzplatz. In der Oberfläche heißen sie „Sitzplatz“, „Reserve“ und
  „Pult“ und sind in Holztönen gezeichnet – gleiche Familie, unterschiedliche
  Helligkeit; die Reserve gestrichelt.
- **Zwei Sorten Reserve, und das ist Absicht:** `reserve` im Raster gehört zum
  Raum und steht in `Raeume/` (defekter Tisch, Platz an der Tafel); ein
  Reserveplatz in der `Platzbelegung` gehört zu **einer** Klausur und steht in
  `4_Raumzuteilung_Export/raumbelegung.csv`. Wer im Sitzplan einen Platz
  freihält, ändert deshalb nie das Raster.
- **Zellen sind halb so hoch wie breit** (`ZELL_HOEHE_ANTEIL` in
  `Raumplan.tsx`): Es sind Tische, keine Quadrate. Wer dort rechnet, braucht
  zwei Schrittweiten – `schritt` für Spalten, `schrittZeile` für Zeilen –, und
  die Schriftgrößen hängen an der Höhe, nicht an der Breite. Im PDF dürfen die
  Kästen höher werden (bis quadratisch), wenn ein breiter Raum sonst die untere
  Seitenhälfte leer ließe.
- **Was in den Kästen steht, ist eine Einstellung** (`PlanAnzeige` im Core:
  Namenskürzel, Matrikelnummer, Sitzplatznummer, Pult-Text). Dasselbe Objekt
  geht in `Raumplan` und in `sitzplanPdf` – gedruckt wird, was man sieht. Am
  Aushang wird `sitzplatznummer` erzwungen: Danach sucht man dort.
- **Ein Tippen auf einen Platz öffnet ein Blatt** (`BlattModal`), kein Modus
  entscheidet vorher, was passiert. Das Blatt ist so hoch wie sein Inhalt,
  höchstens vier Fünftel des Bildschirms – ein Blatt mit drei Zeilen darin
  verdeckte sonst den Plan, um den es gerade geht. Darin steht, wer sitzt, und dort wird
  gesetzt, geräumt, festgehalten und freigehalten. Wer von Hand setzt, setzt
  automatisch eine Vorgabe – sonst säße die Person nach dem nächsten Verteilen
  woanders; `erstelleRaumzuteilung` bekommt diese Vorgaben als
  Matrikelnummer → Raumeinsatz mit.
- Zwei Regeln, an denen sich alles andere ausrichtet:
  1. **Die Sitzplatznummer gehört zum Tisch**, nicht zur Person – vergeben in
     Lesereihenfolge des gespeicherten Rasters, über alle Räume fortlaufend.
     Wer umgesetzt wird, bekommt die Nummer des neuen Tisches.
  2. **Gedreht wird nur die Ansicht.** `anzeigeRaster()` liefert Zellen, die
     ihre gespeicherte Position mitführen; Nummern und Belegung bleiben von
     der Blickrichtung unberührt.
- `verteileImRaum()` behält bestehende Plätze (auch ohne Vorgabe), damit ein
  Umbau des Raums manuelle Platzierungen nicht zunichtemacht. Für eine
  Verteilung von vorne vorher `ohneFreieBelegung()` anwenden. Eine Vorgabe
  bleibt immer liegen – auch wenn die Person (noch) nicht zu diesem Raum
  gehört; „fest“ heißt fest.
- **Zwei Sitzverteilungen** (`Sitzverteilung`): `lesereihenfolge` füllt von
  vorne links, `abstand` wählt die Plätze mit `plaetzeMitAbstand()` so, dass
  die Geprüften möglichst weit auseinandersitzen. Der Abstand ist gewichtet:
  ein Platz zur Seite zählt doppelt (`SPALTEN_GEWICHT`), und wer genau
  hintereinander sitzt, bekommt einen Zuschlag (`RUECKEN_BONUS`) – man sieht
  dem Vordermann in den Rücken, schräg dagegen aufs Blatt.
- **PDFs entstehen im Core, nicht im Druckdialog:** `sitzplaenePdf()` zeichnet
  das Raster der Räume (je Raumeinsatz eine neue Seite), `tabellenPdf()` setzt
  Listen (je Abschnitt eine Seite). So fällt eine Sitzplan-PDF heraus und
  daneben Aushang, Dozenten- und Tutorenliste als eigene Dateien – mit
  `druckeAnsicht` wäre für jede davon ein eigener Druckdialog nötig.
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
- **Geschrieben wird erst auf Ansage:** Über einem Textfeld liegt nicht
  ständig ein Eingabefeld – sonst landet jeder Klick daneben im Text. Hinein
  kommt man wie in einer Tabellenkalkulation per **Doppelklick** (`schreibt`
  im `Textfeld`, der Cursor steht dann am Ende) oder über das Blatt des
  Zeigers. Frisch aufgezogen (Werkzeug „Text“, Feld noch markiert) ist es
  gleich offen – wer eines aufzieht, will hineinschreiben.
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
  Gerechnet wird nicht mit einer Formel, sondern gesucht: `planMasse()` sagt,
  wie breit und hoch der Plan bei einer Zellgröße *wirklich* wird (Polster,
  Köpfe, Fuge zwischen je zwei Zellen), und `passendeZellGroesse()` findet per
  Halbierungssuche die größte, die noch hineinpasst. Fuge und Kopfgröße
  springen in Stufen – eine geschlossene Formel trifft daneben, und genau
  daran scheiterte „Ganzer Raum“ früher: Die Zugaben (bei 31 Zeilen rund
  80 px) fehlten in der Rechnung, die letzten Reihen lagen unter dem Rand.
  Wer `styles.aussen` ändert, ändert `PLAN_POLSTER`/`KOPF_ABSTAND` mit – beide
  Seiten müssen dasselbe meinen.
  Bei so vielen Zellen zählt jede Neuberechnung: Die
  Zellen sind `React.memo` und bekommen deshalb stabile Rückrufe (Position als
  Argument statt frisch erzeugter Closure) und gemerkte Werte (`useMemo` für
  Raster und Belegungskarte).
- **Am Bildschirm liegt der Plan in einem Fenster, auf Papier nicht:** Mit
  `beweglich` (setzt `RaumplanBuehne`) bekommt er einen eigenen Ausschnitt –
  er scrollt in beide Richtungen, ist so hoch wie die Arbeitsfläche es misst
  (ohne Angabe `planFensterHoehe(…)`, dieselbe Höhe, mit der „Ganzer Raum“
  rechnet) und lässt sich schieben und zoomen. Ohne `beweglich` wächst er wie zuvor in die Höhe und scrollt nur
  waagerecht; so gehört er auf den Aushang, der gedruckt wird – ein
  Ausschnitt schnitte dort den halben Raum ab.

### Ziehen im Editor

- Gezogen wird mit Pointer-Events (`onPointerDown/Move/Up`), nicht mit
  Hover-Ereignissen: Beim Ziehen mit dem Finger fängt der Browser den Zeiger
  am Startelement ein, `onPointerEnter` anderer Zellen käme nie an. Welche
  Zelle gemeint ist, rechnet `Raumplan` deshalb aus den Koordinaten
  (`getBoundingClientRect` des Rasters, Zellgröße + Abstand); die Palette
  findet ihr Ziel über `document.elementFromPoint` und das `data-zelle` jeder
  Zelle (`datenAttribute()` in `src/domProps.ts`).
- **Auswählen verändert nichts.** Mit dem Werkzeug „Auswählen“ markiert das
  Ziehen nur ein Rechteck (`Zug.art === 'auswaehlen'`); wer danach *in* der
  Auswahl gedrückt hält und zieht, verschiebt den Block (`verschieben`).
  Gefüllt wird ausschließlich über den Griff an der unteren Ecke bzw. das
  Textwerkzeug (`groesse` → `onAufziehen`) und beim Malen. Vorher zog jedes
  Ziehen den Bereich auf und füllte ihn mit dem Element der Startzelle – damit
  ließ sich nie mehr als eine Zelle auswählen, geschweige denn verschieben.
- Ein Tippen *in* der Auswahl (gedrückt und ohne Bewegung wieder losgelassen)
  setzt die Auswahl auf diese eine Zelle zurück – sonst käme man aus einer
  großen Auswahl nicht mehr heraus.
- Auf den ziehbaren Flächen steht `touch-action: none`, sonst scrollt die
  Seite mit, statt zu zeichnen.
- **Solange ein Zug läuft, hört das Fenster mit** (`pointermove`, `pointerup`,
  `pointercancel` auf `window`): Losgelassen wird oft neben dem Raster, und
  ohne das bliebe der Zug hängen und die nächste Berührung setzte ihn fort.
  Der laufende Zug liegt deshalb auch im Ref (`zugRef`) – wer ihn beendet,
  räumt ihn dort auf, damit er nur einmal ausgewertet wird.
- Schema und Belegung liegen im Screen zusätzlich in Refs
  (`schemataRef`/`belegungRef`) und werden über `uebernehmeSchemata()` bzw.
  `uebernehmeBelegung()` geschrieben. Beim Ziehen kommen viele Änderungen
  schnell hintereinander, und jede muss auf dem Ergebnis der vorherigen
  aufsetzen – der Zustand aus dem Render wäre dafür zu alt. Deshalb: in
  Ereignis-Handlern immer `.current` lesen, im Render den Zustand.

### Schieben und Zoomen mit dem Finger

- Auf dem Planfenster steht `touch-action: none`: Was der Finger dort tut,
  entscheidet der Plan, nicht der Browser. Sonst zöge er die Seite mit,
  während man den Ausschnitt schiebt, und die Pinch-Geste zoomte die ganze
  Seite statt des Raums.
- **Zwei Finger schieben und zoomen immer** – auch mitten in einem Malzug: Der
  zweite Finger bricht den laufenden `Zug` ab (`zugAbbrechen`) und
  `stopPropagation` hält ihn von den Zellen fern. Ein Finger schiebt nur dort,
  wo er nichts zu zeichnen hat: im Sitzplan (Schritt 4, `bearbeiten` aus) und
  mit dem Werkzeug „Verschieben“ (`hand` → `PlanWerkzeug 'schieben'`). Die
  Zeiger liegen dafür in einer Map (`zeigerRef`), gehört wird in der
  Capture-Phase am Planfenster und für Bewegung/Loslassen am `window`.
- **Der Zoom hängt an einem Anker** (`ankerRef`, in Zellen gemessen): Der Punkt
  unter der Mitte zwischen den Fingern bleibt dort, wo er ist. Weil die neue
  Zellgröße erst über die Ansicht zurückkommt, greift der Anker zweimal –
  sofort beim Bewegen (das schiebt zugleich, wenn der Fingerabstand gleich
  bleibt) und noch einmal im `useLayoutEffect`, sobald die neue Größe
  gezeichnet ist.
- **Getippt wird beim Loslassen, nicht beim Drücken.** Im beweglichen Plan
  öffnet ein Platz erst, wenn der Finger sich um weniger als `TIPP_TOLERANZ`
  bewegt hat – sonst öffnete jeder Wisch über den Sitzplan ein Blatt, statt
  den Ausschnitt zu schieben.
- **Auf dem Handy wird das Menüband zur Schublade.** `Menueleiste` zeigt dort
  nur das Burger-Zeichen und was gerade gilt; die Menüs stehen in einer
  Schublade mit zwei Ebenen. Nebeneinander füllten Datei-, PDF- und
  Werkzeugmenü den halben Bildschirm, und vom Plan bliebe nichts übrig. Wer im
  Editor etwas am Layout ändert, prüft das mit einem schmalen Fenster nach.

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

## PDFs an Studierende: `<Matrikelnummer>.pdf`

Die Zulassungs-PDFs (Schritt 2) und die Sitzplatz-PDFs (Schritt 4) heißen
**nach der Matrikelnummer** – das ist kein Namensschema, sondern die
Schnittstelle: Das Stud.IP-Werkzeug „Klausureinsicht“ gibt jeder Person genau
die Datei frei, deren Name ihrer Matrikelnummer entspricht. Wer den Dateinamen
ändert, bricht die Verteilung.

Die Schritte drumherum (unsichtbarer Dateiordner mit „Zugriff auf Dateien per
Link“, Werkzeug aktivieren, Reiter umbenennen, Ordner im Werkzeug auswählen)
stehen an **einer** Stelle im Code: `components/StudipEinsicht.tsx`, von beiden
Screens benutzt und nur im Namen des Reiters unterschieden. Zweimal
hingeschriebene Anleitungen laufen auseinander, und die Zeile, die zählt, ist
„der Ordner muss unsichtbar sein“ – sichtbar zeigte er jeder Person die
Schreiben aller anderen.

## Text der Schreiben (Vorlagen)

Was in den Zulassungs- und Sitzplatz-PDFs steht, gehört **nicht in den
Quelltext**: Der Wortlaut ändert sich jedes Semester, und wer ihn ändern will,
soll dafür nicht das Repository anfassen müssen. `packages/core/src/pdfVorlage.ts`
hält den Anfangstext (`VORLAGE_ZULASSUNG`, `VORLAGE_SITZPLATZ`), die
Platzhalterlisten und den Markdown-Leser; `vorlagenPdf()` in `pdf.ts` setzt das
Ergebnis aufs Blatt. Die App bearbeitet die Vorlage im `VorlagenModal` und legt
sie im Projekt unter `Vorlagen/` ab (Rolle `pdfVorlage`).

- Unterstützt wird nur, was ein Anschreiben braucht: `#`/`##`/`###`,
  `**fett**`, `*kursiv*`, `- `/`1. `, `---`. **Jede Zeile beginnt eine neue
  Zeile** – ein Anschreiben wird zeilenweise gesetzt, nicht zu einem
  Fließtextabsatz zusammengezogen; eine Leerzeile ist ein halber Zeilenabstand.
- Kursiv gilt nur für Sternchen, nicht für Unterstriche: `94_E01 bis 94_E03`
  soll aufrecht bleiben.
- Unbekannte Platzhalter bleiben stehen (`<Vornmae>` im PDF ist ein sichtbarer
  Tippfehler, ein leeres Feld wäre ein unsichtbarer).
- Wer die Anfangstexte ändert, führt `python3 tools/build_sample_project.py`
  aus: Der Builder liest sie aus `pdfVorlage.ts` und schreibt sie nach
  `Beispielprojekt/Vorlagen/` – zwei Fassungen desselben Textes laufen sonst
  binnen eines Semesters auseinander.

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

- `yarn test` – Jest-Tests der Fachlogik **und** der Kommandozeile. Sie laufen
  gegen die Beispieldaten des Repos und prüfen die erwarteten Zahlen (6 neue
  Zulassungen, 9 mit Zulassung, 7 zugelassene Angemeldete, 1 ohne Zulassung,
  7 Sitzplätze). Neue Fachlogik bekommt neue Tests in `packages/core/test/`,
  neue Befehle in `packages/cli/test/`.
- `yarn typecheck` – alle drei Pakete müssen sauber sein.
- Die Befehle einmal wirklich laufen lassen, am besten gegen eine **Kopie**
  von `Beispielprojekt/`: `yarn 1_vips --projekt <Kopie> …` schreibt in den
  Ordner, den es bekommt.
- E2E: `yarn web` starten, dann `maestro test .maestro/durchlauf.yaml`
  (siehe `.maestro/README.md`). Wer UI-Texte der Screens ändert, prüft den
  Flow – er asserted auf sichtbare Texte.
- Wer die Python-Referenz anfasst: kompletten Durchlauf aus der README
  ausführen und mit denselben Zahlen vergleichen; erzeugte PDF-Ordner
  (`pdfs/`, `studipKlausurzulassungPdfs/`) danach wieder entfernen.

## Direkt auf `main` arbeiten

Fertige Änderungen gehen **direkt nach `main`** – auch die von KI-Agenten. Ein
Branch und ein Pull Request sind nicht nötig: Das Repository hat einen
Betreuer, und der Umweg kostet hier mehr, als er einbringt.

**Diese Erlaubnis gilt dauerhaft und für jede Session**; sie ist nicht jedes
Mal neu zu erfragen. Startet eine Session auf einem eigenen Branch (etwa aus
der Claude-Code-Web-Oberfläche), gilt dasselbe: Die fertige Arbeit darf ohne
weitere Nachfrage nach `main` – ein Pull Request nur, wenn jemand ausdrücklich
darum bittet.

Der Push auf `main` baut zugleich die GitHub-Pages-Seite neu (siehe
„Automatische Prüfungen“), fertig heißt also wirklich fertig:

- **Vorher** `yarn test` und `yarn typecheck` lokal grün, und was an der
  Oberfläche geändert wurde, einmal im Browser angesehen.
- **Vorher** `git pull --rebase origin main` – auf `main` committen andere
  (und der Data-Clumps-Workflow) ebenfalls.
- **Nicht** auf `main` force-pushen und dort keine fremde Historie
  umschreiben: Was einmal gepusht ist, bleibt stehen; Fehler werden mit einem
  neuen Commit korrigiert.
- Wer trotzdem lieber über einen Branch geht (halbfertige Arbeit, etwas zum
  Draufschauen), darf das – nur bleibt `main` der Normalfall.

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
- **Bewusste Abweichung von der Python-Referenz:** `createRoomAssignment.py`
  liest die Plätze eines Raums aus der Spalte `Plätze` seiner `raeume.csv`;
  App und Kommandozeile nehmen dafür die Tische im Raster. Zwei Zahlen für
  dieselbe Sache liefen in der Praxis auseinander – wer einen Tisch aus dem
  Plan nahm, hatte hinterher einen Platz zu viel in der Liste. Die
  Python-Datei bleibt, wie sie ist; die App liest sie weiter und überliest
  nur die Spalte.
