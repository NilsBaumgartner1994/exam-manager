# Exam Manager

[![Test](https://github.com/NilsBaumgartner1994/exam-manager/actions/workflows/test.yml/badge.svg)](https://github.com/NilsBaumgartner1994/exam-manager/actions/workflows/test.yml)
[![Deploy Web (GitHub Pages)](https://github.com/NilsBaumgartner1994/exam-manager/actions/workflows/deploy-web.yml/badge.svg)](https://github.com/NilsBaumgartner1994/exam-manager/actions/workflows/deploy-web.yml)
[![Data Clumps](reports/data-clumps-doctor/badges/data-clumps.svg)](https://github.com/NilsBaumgartner1994/exam-manager/actions/workflows/data-clumps.yml)

[https://nilsbaumgartner1994.github.io/exam-manager/](https://nilsbaumgartner1994.github.io/exam-manager/)

Werkzeuge rund um die Verwaltung einer Universitätsklausur: Prüfungsanmeldungen
einlesen, Klausurzulassungen über mehrere Jahre verwalten, Studierende
informieren und Räume samt Sitzplätzen zuteilen.

Der komplette Ablauf ist in [WORKFLOW.md](WORKFLOW.md) beschrieben.

> **Ziel:** Die heutigen Python-Skripte werden durch ein **lokales
> TypeScript-Web-Tool** ersetzt – siehe [Roadmap](#roadmap).

## ⚠️ Datenschutz zuerst

Dieses Repository enthält **ausschließlich erfundene Beispieldaten**. Echte
Namen, Matrikelnummern, E-Mail-Adressen oder Punktestände dürfen niemals
committet werden.

- Echte Exporte gehören nach `_private/` – dieser Ordner ist in `.gitignore`.
- Erzeugte PDFs (`pdfs/`, `studipKlausurzulassungPdfs/`) enthalten
  personenbezogene Daten und sind ebenfalls ignoriert.
- Vor jedem Commit prüfen: `git status` und ein Blick in die geänderten CSVs.

## Beispieldaten

Zehn Teilnehmende, Vornamen alphabetisch, Matrikelnummern ab `1000001`,
E-Mails nach dem Muster `<vorname>@test.de`:

| Matrikelnr. | Name | VIPS bestanden (neue Zulassung) | Alte Zulassung | Zur Klausur angemeldet |
|---|---|:--:|:--:|:--:|
| 1000001 | Archimedes Archi | ✅ | | ✅ |
| 1000002 | Blaise Pascal | | ✅ | ✅ |
| 1000003 | Charles Darwin | ✅ | | ✅ |
| 1000004 | Dorothy Hodgkin | ✅ | | ✅ |
| 1000005 | Erwin Schrödinger | ✅ | | ✅ |
| 1000006 | Francis Crick | | | ✅ |
| 1000007 | Galileo Galilei | | ✅ | ✅ |
| 1000008 | Hedy Lamarr | | ✅ | ✅ |
| 1000009 | Isaac Newton | ✅ | | |
| 1000010 | Johannes Kepler | ✅ | | |

Dazu kommen im Stud.IP-Export zwei Lehrende (Ada Lovelace, Alan Turing) und
zwei Tutor:innen (Grace Hopper, Kurt Goedel). Sie stehen – wie im echten Export –
**vor** den alphabetisch sortierten Studierenden und sind an der Spalte
`Status` (`dozent`/`tutor` statt `autor`) erkennbar; eine Matrikelnummer haben
sie nicht.

Der Datensatz deckt bewusst die interessanten Fälle ab:

- **Francis Crick** ist angemeldet, hat aber keine Zulassung → landet in `notAllowedStudents.csv`.
- **Blaise Pascal**, **Galileo Galilei**, **Hedy Lamarr** sind dieses Jahr durchgefallen, haben aber eine Zulassung aus dem Vorjahr.
- **Isaac Newton** und **Johannes Kepler** haben die Zulassung erworben, sich aber nicht zur Klausur angemeldet.
- **Charles Darwin** taucht erst nach einem Punkte-Nachtrag des Tutors auf (`tutor_vergisst_punkte/`).
- **Erwin Schrödinger** prüft, ob Umlaute die UTF-8-Kette überstehen.

Beispieldaten neu erzeugen (nur die Eingangsdaten; alles Weitere entsteht durch
die Pipeline):

```bash
python3 tools/generate_sample_data.py
python3 tools/build_sample_project.py   # daraus: Beispielprojekt/
```

`Beispielprojekt/` ist ein fertiger Projektordner für die Web-App: Jede
Eingabedatei liegt dort in dem Ordner, in dem die App sie sucht (siehe
[Web-App](#screens)). Zum Ausprobieren auf der Startseite einfach diesen
Ordner auswählen.

## Ordnerstruktur

```
Beispielprojekt/                   Beispiel-Projektordner für die Web-App (siehe unten)
Zulassungen/                       Zulassungsbestand aller Jahre + Prüfung der Anmeldungen
Zuslassungliste_Erstellen/
  1_check_bestandene_vips/         Wer hat dieses Jahr die Übungen bestanden?
  2_mail_versenden_.../            Studierende über ihre Zulassung informieren
  3_rundmail_an_alle/              Vorlage für die Rundmail
  4_MailRaumZuordnung/             Teilnehmendenliste, Raum- und Sitzplatzzuteilung
tools/generate_sample_data.py      Erzeugt den anonymisierten Beispiel-Datensatz
tools/build_sample_project.py      Baut daraus Beispielprojekt/ zusammen
WORKFLOW.md                        Der Ablauf einer Klausur von A bis Z
```

Jeder Schritt-Ordner hat eine eigene `README.md` mit den konkreten Aufrufen.

## Datenformate

Alle CSV-Dateien: Trennzeichen `;`, UTF-8, Zeilenende `\n`.

| Format | Spalten |
|---|---|
| Zulassungsliste | `Nachname;Vorname;Matrikelnummer;E-Mail` |
| Anmeldungen (`check.csv`) | `Nachname;Vorname;Matrikelnummer` (ohne Kopfzeile) |
| VIPS-Notenliste | `Nachname;Vorname;Kennung;Matrikelnr.;<Aufgabenblatt …>;Summe` (Zeile 2 = Maximalpunktzahl, Datei mit BOM) |
| Stud.IP-Export | `Status;Anrede;Titel;Vorname;Nachname;…;E-Mail;Anmeldedatum;Matrikelnummer;Studiengänge;Position` (alle Felder in `"`) |
| Raumliste | `Raum;Plätze;ReservierteZeit`. In `Raeume/raeume.csv` steht der Bestand des Hauses (jeder Raum einmal), in `4_Raumzuteilung_Export/klausurraeume.csv` die Räume **dieser** Klausur – dort darf ein Raum mehrfach stehen, dann wird er mehrfach belegt (Gruppe 1 / Gruppe 2) |
| Raumschema (je Raum eine Datei, `94_E01.csv`) | Raster statt Kopfzeile: `Raum;<Name>` beginnt einen Raum, jede weitere Zeile ist eine Reihe im Raum. Zellen: `T` Sitzplatz (Tisch für Studierende), `R` Reserve (Tisch, der in diesem Raum dauerhaft frei bleibt – ohne Sitzplatznummer), `P` Pult (Tisch ohne Sitzplatz), `D` Tür, `W` Wand, `.` frei. Freier Text über verbundenen Zellen steht in eigenen Zeilen: `Text;<Zeile>;<Spalte>;<Höhe>;<Breite>;<Text>` – er liegt über dem Raster, die Zellen darunter bleiben erhalten |
| Raumbelegung (`raumbelegung.csv`) | `Raum;Zeile;Spalte;Sitzplatznummer;Matrikelnummer;Nachname;Vorname;Reserviert;Vorgabe` (Sitzplatznummer, Nachname und Vorname stehen nur zur Lesbarkeit darin und werden beim Einlesen ignoriert) |

Ein Raumschema bildet den Aufbau des Raumes direkt ab und lässt sich deshalb
auch in Excel bearbeiten. Jeder Raum liegt in einer eigenen Datei, benannt nach
dem Raum (`Raeume/94_E01.csv`) – so ist im Ordner zu sehen, welche Räume es
gibt, und ein einzelner Raum lässt sich austauschen, ohne die anderen
anzufassen. Mehrere Räume in einer Datei liest die App weiterhin:

```
Raum;94/E01
W;W;W;W;W;W;W;W;W
.;P;.;.;.;.;.;.;.
.;.;.;.;.;.;.;.;.
.;T;T;T;.;T;T;T;.
…
.;D;.;.;.;.;.;D;.
W;W;W;W;W;W;W;W;W
Text;1;3;1;5;Klausur SWE – Raum 94/E01
```

Die letzte Zeile ist ein Textfeld über verbundenen Zellen: ab Zeile 1,
Spalte 3, eine Zeile hoch und fünf Spalten breit. Die Beispieldaten enthalten
fünf echte Räume – vom Seminarraum `94/E01` (9 × 17 Felder) bis zum Hörsaal
`01/E01` mit 44 × 32 Feldern. In den Hörsälen sitzt nur jede dritte Person:
Zwischen zwei Sitzplätzen (`T`) bleibt die Tischfläche (`P`) frei, deshalb ist
die Platzzahl deutlich kleiner als die Zahl der Sitze im Raum.

## Voraussetzungen

Python 3 mit `pandas`, `openpyxl` (Excel-Import) und `reportlab` (PDFs):

```bash
pip3 install pandas openpyxl reportlab
```

## Kompletter Durchlauf mit den Beispieldaten

```bash
# 1) Anmeldungen des Prüfungsamts einlesen
cd Zulassungen && python3 1_transform_exel_to_csv.py

# 2) Neue Zulassungen aus den VIPS-Punkten
cd ../Zuslassungliste_Erstellen/1_check_bestandene_vips
python3 checkPermissionVips.py \
  --input_vips_notenliste Notenliste.csv \
  --input_studip_liste Teilnehmendenexport_Beispielveranstaltung.csv \
  --output ./tutor_vergisst_punkte/vips_output.csv \
  --min_punkte_pro_blatt 30 --min_blaetter_bestehen 3
cp tutor_vergisst_punkte/vips_output.csv ../../Zulassungen/pv2025_zulassungen.csv

# 3) Alle Teilnehmenden mit Zulassung (neu oder aus Vorjahren)
cd ../2_mail_versenden_bestandene_vips_individuell
python3 1_erstelle_liste_mit_zulassung_aus_teilnehmer_liste.py \
  --teilnehmende Teilnehmendenexport_Beispielveranstaltung.csv \
  --zulassungen ./../../Zulassungen \
  --out-ohne-mail ./mitZulassungOhneMail.csv \
  --out-mit-mail ./mitZulassungMitMail.csv

# 4) Anmeldungen gegen den Zulassungsbestand prüfen
cd ../../Zulassungen
python3 checkPermissions.py --display yes --out ./allowedStudents.csv    ./check.csv
python3 checkPermissions.py --display no  --out ./notAllowedStudents.csv ./check.csv

# 5) Raum- und Sitzplatzzuteilung
cp allowedStudents.csv ../Zuslassungliste_Erstellen/4_MailRaumZuordnung/2_raum_zuteilung_erstellen/result.csv
cd ../Zuslassungliste_Erstellen/4_MailRaumZuordnung/2_raum_zuteilung_erstellen
echo 2 | python3 createRoomAssignment.py \
  --teilnehmer ./result.csv \
  --studip ../1_Teilnehmer_erzeugen_oder_laden/teilnehmer.csv \
  --raeume raeume.csv \
  --output studierendeZuRaumUndZeitZuordnung.csv
```

Erwartetes Ergebnis: 6 neue Zulassungen, 9 Teilnehmende mit Zulassung,
7 zugelassene Angemeldete, 1 Person ohne Zulassung, 7 Sitzplätze in 5 Räumen.

## Web-App (TypeScript)

Die Prüfungsverwaltung läuft komplett **lokal im Browser**: Dateien werden per
Dateiauswahl eingelesen, im Browser verarbeitet und als Download wieder
gespeichert. Kein Server, kein Upload – die Daten verlassen den Rechner nicht.

```bash
nvm use          # Node 22 (siehe .nvmrc)
yarn install
yarn web         # Dev-Server: http://localhost:8081
yarn test        # Jest-Tests der Fachlogik (packages/core)
yarn typecheck   # TypeScript-Prüfung beider Pakete
```

### Screens

Ganz oben auf der Startseite steht das **Projekt**, darunter die fünf Kacheln
entlang des Workflows:

0. **Projekt** – welcher **Kurs**, welcher **Ordner**, und der Weg zurück auf
   die Platte: „Projektordner öffnen“ bzw. „Anderes Projekt öffnen“ und
   „Aktuelles Projekt herunterladen“. Alles Weitere hängt daran, deshalb steht
   es vor den Schritten.

   **Der Kursname** steht in keiner Datei – Stud.IP legt ihn nur in den Namen
   des Teilnehmendenexports. Die App liest ihn von dort:
   `Teilnehmendenexport_Software_Engineering.csv` → „Software Engineering“.
   Liegt kein Export im Projekt, steht dort „—“ statt eines geratenen Namens.

   Der Projektordner hält alle Dateien einer Klausur an einem Ort.
   **Der Ordner entscheidet, was gelesen wird:** Eine Datei
   zählt nur, wenn sie am vorgesehenen Platz mit der passenden Endung liegt –
   eine Notenliste im Hauptordner oder ein Stud.IP-Export in `Zulassungen/`
   bleibt bewusst „nicht zugeordnet“. Lieber eine Datei sichtbar ignorieren
   als die falsche auswerten. Welche Dateien erkannt wurden, zeigt
   „Dateien anzeigen“.

   ```
   0_Input_Klausuranmeldungen/            *.xlsx              Anmeldungen des Prüfungsamts
   0_Input_Kurs_Teilnehmer_Studip_Liste/  *.csv               Teilnehmendenexport aus Stud.IP
   0_Input_Vips_Notenliste/               *.csv               Notenliste aus VIPS
   Zulassungen/                           *zulassungen*.csv   je Jahr eine Liste der Zugelassenen
   Raeume/                                *.csv               raeume.csv + je Raum ein Raster (blanko)
   Vorlagen/                              *vorlage*.md        Text der Schreiben an Studierende (Markdown)
   2_Zulassungs_PDFs_Export/              *.pdf               erzeugte Zulassungs-PDFs (Schritt 2)
   3_Klausur_Teilnehmende_Export/         *.csv               Angemeldete mit/ohne Zulassung (Schritt 3, optional)
   4_Raumzuteilung_Export/                *.csv               Räume dieser Klausur, Sitzplan, Belegung (Schritt 4)
   ```

   Die `0_Input_…`-Ordner nehmen auf, was von außen kommt; die nummerierten
   Export-Ordner füllt die App. `Zulassungen/` und `Raeume/` sind unnummeriert,
   weil sie über eine einzelne Klausur hinaus gelten – die Raumraster sind
   deshalb **blanko**, ohne platzierte Studierende, und lassen sich für jeden
   Sitzplan wiederverwenden.

   Einmal ausgewählt, holen sich die Schritte ihre Eingaben von selbst und
   schreiben ihre Ergebnisse zurück. **Auf jedem Screen** gibt es den Button
   „Aktuelles Projekt herunterladen“: Er packt den kompletten Stand als
   ZIP – auch Dateien, die zu keiner Regel passen, bleiben unverändert
   enthalten. Damit ersetzt man den eigenen Ordner. Wer neu anfängt, lädt die
   **Projektvorlage als ZIP** herunter: die leere Struktur mit `LIESMICH.md`
   je Ordner. `Beispielprojekt/` in diesem Repository ist ein gefüllter
   Ordner zum direkten Ausprobieren.

   Der Stand bleibt **in diesem Browser** – auch nach einem Neuladen, samt
   aller Änderungen (er liegt im `localStorage` dieses Geräts, nicht auf einem
   Server). Ein neuer Ordner ersetzt ihn vollständig; „Projekt schließen“ auf
   der Startseite entfernt ihn wieder. Das sind Personendaten – am fremden
   Rechner also unbedingt schließen. Für PDFs und Excel-Dateien reicht der
   Browserspeicher nicht immer; sagt die Startseite das, hilft nur die ZIP.
   Zurückschreiben in den Ordner darf der Browser ohnehin nicht – daher der
   Umweg über die ZIP.

Und die vier Schritte selbst:

1. **VIPS-Punkte auswerten** – Notenliste und Teilnehmendenexport kommen aus
   `0_Input_Vips_Notenliste/` und `0_Input_Kurs_Teilnehmer_Studip_Liste/` des
   Projektordners (oder von Hand), Kriterien eingeben (Min. Punkte pro Blatt,
   Anzahl Blätter). Unten: **„Zugelassene Studierende in den
   Zulassungen-Ordner ablegen“** – die neue Jahresliste landet im Projekt
   unter `Zulassungen/` und wird zugleich heruntergeladen – und **„Weiter zu
   2. Zulassung prüfen & PDF generieren“**.
2. **Zulassung prüfen & PDF generieren** – nimmt die Zulassungslisten und den
   Stud.IP-Export direkt aus dem Projektordner (inklusive der Liste aus
   Schritt 1). Ein Suchfeld beantwortet die Einzelfrage „hat diese Person eine
   Zulassung?“: Name (Schreibweise, Reihenfolge und Umlaute egal) oder
   Matrikelnummer eingeben, und es zeigt jeden Treffer samt der Datei, aus der
   die Zulassung stammt – ein Datum wird nirgends gespeichert, das Jahr steht
   im Dateinamen (`pv2025_zulassungen.csv`). Der Rest des Screens erzeugt je
   Person mit Zulassung ein `<Matrikelnummer>.pdf`, gesammelt als ZIP (für die
   Stud.IP-„Klausureinsicht“). Im Projekt landen
   sie in `2_Zulassungs_PDFs_Export/`; **PDFs eines früheren Laufs werden
   dabei entfernt** – sie gehören zu einem Stand, den es nicht mehr gibt.
   Die eingebaute PDF-Schrift kann nur WinAnsi: Umlaute und ß stehen darin,
   `ź` oder `ł` nicht. Statt am ersten solchen Namen abzubrechen, schreibt die
   App ihn um (`Woźniak` → `Wozniak`) und nennt jeden betroffenen Namen im
   Ergebnis.

   **Text der PDFs:** Was in den Schreiben steht, ist eine Vorlage und kein
   Quelltext – „Text anpassen“ öffnet sie (siehe „Text der Schreiben“ unten).
3. **Klausur-Anmeldungen prüfen** – HIS-Export (`check.xlsx`) gegen den
   Zulassungsbestand prüfen; Zugelassene/Nicht-Zugelassene anzeigen und als
   CSV herunterladen. Der Export ist nur für den Klausurdruck nötig – Schritt 4
   kommt auch ohne ihn aus (siehe dort).
4. **Raumzuteilung & Sitzplan** – Teilnehmende aus Schritt 3 (oder aus den
   Anmeldungen selbst, siehe unten), die Räume dieser Klausur
   zusammenstellen, Sitzplätze ab Startnummer
   (Default 1001) vergeben; Ansichten: Aushang (anonym), Dozent (nach
   Sitzplatz), Tutor (nach Nachname), Räume/Aushänge je Raum; Export als CSV,
   Sitzplatz-PDFs (ZIP) und alle Aushänge als PDF über den Druckdialog. Auch
   hier lässt sich der **Text der PDFs** anpassen (siehe unten).

   **Aufbau wie eine Tabellenkalkulation** (genauso in Schritt 5): oben im
   Kopf der App „Zurück“ und der Titel, darunter das Menüband – die Leiste
   **Datei** (speichern und laden), die Leiste **PDF** und die **Reiter**;
   dazwischen nichts als die Arbeitsfläche in voller Breite; unten die
   **Fußleiste** mit Ansicht/Zoom und dem Stand (belegte Plätze, Rastergröße,
   Meldungen). Die Reiter sind **Einstellungen** (Teilnehmende, Räume der
   Klausur, Zuteilung), **Listen** (Aushang, Dozent, Tutor, Aushänge je Raum)
   und **je ein Reiter pro Raumeinsatz** mit dessen Sitzplan. Auf schmalen
   Bildschirmen scrollen die Leisten waagerecht, statt umzubrechen – der Plan
   soll den Platz behalten.

   **Ohne Umweg über Schritt 3:** Liegt im Projektordner keine Teilnehmerliste
   in `3_Klausur_Teilnehmende_Export/`, prüft dieser Schritt die Anmeldungen
   aus `0_Input_Klausuranmeldungen/` selbst gegen den Zulassungsbestand. Sind
   **alle** Angemeldeten zugelassen, werden sie ohne Rückfrage übernommen. Ist
   jemand nicht zugelassen, steht das oben im Screen mit Namen, und die
   Entscheidung liegt beim Nutzer: nur die Zugelassenen verwenden, trotzdem
   alle Anmeldungen verwenden – oder doch eine eigene Teilnehmer-CSV auswählen.
   Die E-Mail-Adressen kommen dabei aus dem Zulassungsbestand; der HIS-Export
   hat keine.

   **Verteilen:** Über die Räume hinweg entweder **gleichmäßig** (nach
   relativer Auslastung) oder **Raum für Raum**. Innerhalb eines Raums
   entweder **der Reihe nach** oder mit **größtmöglichem Abstand**: Dann
   werden die Plätze so gewählt, dass die Geprüften möglichst weit
   auseinandersitzen – ein Platz zur Seite zählt doppelt (dort schaut man
   direkt aufs Nachbarblatt), und zwei sitzen lieber hintereinander als schräg
   versetzt, weil man dem Vordermann in den Rücken sieht.

   **Räume der Klausur:** Der Bestand des Hauses steht in `Raeume/` (Schritt 5)
   und gilt für jedes Jahr. Hier wird ausgewählt, welche dieser Räume die
   Klausur benutzt: ein Klick auf `+ 01/E01` nimmt den Raum auf, Plätze und
   reservierte Zeit lassen sich danach ändern. **Denselben Raum mehrfach
   hinzufügen heißt: Er wird mehrfach belegt** – etwa Gruppe 1 vormittags und
   Gruppe 2 nachmittags. Jeder dieser Durchgänge bekommt einen eigenen
   Sitzplan, eine eigene Belegung und eigene Sitzplatznummern; das Raster
   teilen sie sich, denn es ist derselbe Raum. Auseinander hält sie die
   reservierte Zeit, die auf Aushang und PDF neben dem Raumnamen steht. Die
   Liste landet als `klausurraeume.csv` in `4_Raumzuteilung_Export/` – nicht in
   `Raeume/`, denn sie gilt nur für diese eine Klausur.

   **Sitzplan im Raum:** Zu jedem Raum lässt sich ein Raster hinterlegen, das
   den Aufbau des Raumes abbildet – wo Tische stehen, wo Tür, Wand und Pult
   sind (je Raum eine CSV in `Raeume/`, siehe oben). Auf diesem Raster werden
   die Studierenden platziert:

   Der Sitzplan steht **schon vor der Zuteilung**: Sobald Räume gewählt sind,
   sind die Pläne da – leer, aber vollständig. So lassen sich Plätze vorab
   freihalten und einzelne Personen fest setzen, bevor verteilt wird.

   - **Auf einen Platz tippen** öffnet ein Blatt über die volle Breite. Darin
     steht, wer dort sitzt (Name, Matrikelnummer, Sitzplatznummer), und was
     sich tun lässt: **jemanden hierher setzen** (Suchfeld über alle
     Teilnehmenden – wer schon woanders sitzt, tauscht den Platz), den
     **Platz räumen**, die **Vorgabe** lösen oder setzen und den Platz als
     **Reserve** freihalten.
   - **Vorgabe** – wer von Hand gesetzt wird, bleibt dort: auch bei „Sitzplan
     neu verteilen“ und bei einer neuen Zuteilung (die Person kommt dann in
     genau diesen Raum). Im Plan steht „fest“ daneben.
   - **Reserve** – ein Platz, der für **diese** Klausur frei bleibt; wer
     dadurch verdrängt wird, rückt auf einen freien Tisch nach (bleibt keiner
     übrig, nennt die App die Person). Die Reserve steht in der Belegung,
     nicht im Raster des Raums – ein dauerhaft freier Tisch bekommt in
     Schritt 5 das Element „Reserve“.
   - **Was in den Kästen steht** – Häkchen über dem Plan: Namenskürzel,
     Matrikelnummer, Sitzplatznummer, „Pult“ beschriften. Sie gelten für den
     Bildschirm **und** für die PDFs; auf dem Aushang steht die Sitzplatznummer
     immer.
   - **PDFs** – „Sitzpläne als PDF“ erzeugt eine Datei mit einer Seite je Raum,
     dazu getrennt „Aushang als PDF“ (eine Seite je Raum),
     „Dozentenliste als PDF“ (nach Sitzplatz) und „Tutorenliste als PDF“ (nach
     Nachname). Gezeichnet wird dasselbe Raster wie am Bildschirm.
   - **Zeiger (voreingestellt)** – das neutrale Werkzeug: Ein Klick in den Plan
     öffnet ein Blatt mit dem, was an dieser Stelle ist – Art der Zelle,
     Sitzplatznummer, wer dort sitzt, welcher Text darüber liegt – und ändert
     nichts. Dort steht auch der **Text dieser Stelle zum Hineinschreiben**
     („Text anlegen“, wenn noch keiner da ist). Gezeichnet wird erst, wenn man
     ein Element aus der Palette wählt; ein Ziehen mit dem Zeiger schiebt den
     Ausschnitt.
   - **Raum bearbeiten** – im Menüband über dem Plan liegt die Palette
     (Zeiger, Auswählen, Verschieben, Sitzplatz, Reserve, Pult, Wand, Tür,
     Text, Radierer). Ein Element auf eine Zelle **ziehen**
     setzt es dort; **antippen** wählt es aus und man malt damit im Plan (über
     Zellen ziehen zeichnet z. B. eine ganze Wand). Mit **Auswählen** zieht
     man über mehrere Zellen, ohne etwas zu verändern – markiert wird nur –,
     und **gedrückt halten in der Auswahl** verschiebt den ganzen Block; die
     Belegung wandert mit. Am blauen **Griff an der unteren Ecke** zieht man
     die Auswahl wie in einer Tabellenkalkulation über mehrere Felder auf oder
     wieder zusammen und füllt sie dabei. Zeilen und Spalten lassen sich
     zusätzlich über die Knöpfe hinzufügen und entfernen.
   - **Sitzplatz, Reserve oder Pult?** Alle drei sind Tische. Ein
     **Sitzplatz** (`T`) ist ein Tisch, an dem jemand geprüft wird: Nur diese
     werden nummeriert und belegt, und nur sie zählt die Platzzahl des Raums.
     Ein **Reserve**-Tisch (`R`) bleibt in diesem Raum dauerhaft frei – der
     defekte Tisch, der Platz direkt an der Tafel, der der Aufsicht – und
     bekommt keine Nummer; warum, schreibt man mit dem Textwerkzeug darauf.
     Das **Pult** (`P`) ist der einfache Tisch für alles andere (Ablage,
     Materialtisch).
   - **Flache Kästen:** Eine Zelle ist halb so hoch wie breit – es sind Tische,
     keine Quadrate. So passen doppelt so viele Reihen ins Bild, ohne dass die
     Kästen schmaler werden.
   - **Rückgängig / Wiederholen** – jeder Schritt im Plan lässt sich zurück-
     nehmen: die Knöpfe im Menüband oder <kbd>Strg</kbd>/<kbd>⌘</kbd> +
     <kbd>Z</kbd> (vorwärts mit <kbd>Umschalt</kbd> + <kbd>Z</kbd> bzw.
     <kbd>Y</kbd>). Das gilt auch fürs Platzieren, für Reserven und Vorgaben –
     Raster und Belegung gehen immer zusammen einen Schritt zurück.
   - **Text und verbundene Zellen** – mit dem Werkzeug **Text** zieht man über
     mehrere Felder ein Feld auf, in das sich frei schreiben lässt (z. B.
     „Tafel“, „Haupteingang“ oder ein Hinweis für die Aufsicht). Dasselbe
     leisten die Knöpfe **Zellen verbinden** und **Zellen trennen** für die
     aktuelle Auswahl. Das Feld legt sich **über** den Plan, statt ihn zu
     ersetzen: So lässt sich auch eine Tür, ein Pult oder eine ganze
     Tischreihe beschriften – die Zellen darunter bleiben, was sie sind. Weg
     ist ein Feld mit **Zellen trennen** oder dem Radierer.
     **Hineingeschrieben** wird wie in einer Tabellenkalkulation per
     **Doppelklick** auf das Feld – oder im Blatt des Zeigers. Ein einzelner
     Klick schreibt nicht: Er gehört dem Werkzeug, damit man nicht aus
     Versehen im Text landet.
   - **Raster sehen** – jedes Feld hat eine dünne Linie, oben stehen die
     Spalten als `A`, `B`, `C` … und links die Zeilen als `1`, `2`, `3` – wie
     in einer Tabellenkalkulation. Die Fußleiste nennt die Rastergröße und
     die Adresse der Auswahl (etwa `B3:E7`). So ist zu erkennen, wie groß der
     Raum ist und wo sich klicken lässt – auch dort, wo noch nichts steht.
     Der Aushang verzichtet darauf.
   - **Größe der Ansicht** – in der Fußleiste, drei Möglichkeiten, weil je
     nach Raum eine andere passt: **Ganzer Raum** (Voreinstellung) zeigt auch
     einen Hörsaal mit 47 × 34 Feldern am Stück – der Plan füllt die
     Arbeitsfläche, gescrollt werden muss nichts. **Auf Breite** nutzt die
     volle Breite und scrollt in die Höhe, wenn die Kästen größer sein sollen.
     Mit **−** und **+** stellt man die Zellgröße selbst ein wie beim Zoomen
     in ein Bild; die Leiste nennt sie dann in Pixeln. Der Zoom setzt auf der
     gerade sichtbaren Größe auf, springt also nicht.
   - **Schieben und Zoomen (auch auf dem Handy)** – der Plan liegt am
     Bildschirm in einem eigenen Fenster: **zwei Finger** schieben ihn und
     zoomen zugleich (am Rechner <kbd>Strg</kbd> + Mausrad, ohne Taste
     scrollt das Rad im Plan). Mit dem Werkzeug **Verschieben** genügt ein
     Finger – sonst würde jeder Wisch mit dem gewählten Element malen. Im
     Sitzplan (Schritt 4) schiebt ein Finger ohnehin: Dort öffnet erst ein
     **Tippen** den Platz, ein Wischen bewegt den Ausschnitt.
   - **Drehen** – die Ansicht je Raum um 90° drehen (vier Richtungen), damit
     sie zur eigenen Blickrichtung im Raum passt. Gedreht wird nur die
     Darstellung; die gespeicherten Positionen und die Sitzplatznummern
     bleiben gleich.

   Die Sitzplatznummer gehört zum **Tisch** (fortlaufend über alle Räume in
   Lesereihenfolge des Rasters), nicht zur Person: Wer umgesetzt wird, bekommt
   die Nummer des neuen Tisches. Raster und Belegung lassen sich als CSV
   speichern und wieder laden.

5. **Räume & Raumpläne** – dieselben Raster, aber **ohne Teilnehmende**: Räume
   anlegen, ihre Grundrisse zeichnen und beides speichern. Ein Raum überlebt
   die einzelne Klausur – derselbe Hörsaal wird jedes Semester wieder
   gebraucht, sein Grundriss ändert sich fast nie –, deshalb liegen Raumliste
   und Raster im Projektordner zusammen in `Raeume/`, außerhalb der
   nummerierten Schritt-Ordner. Hier steht der **Bestand des Hauses**; welche
   davon eine Klausur benutzt (und ob mehrfach), entscheidet Schritt 4 und legt
   nur noch die Belegung darüber.

   **Derselbe Aufbau wie Schritt 4:** Menüband oben (Leiste **Datei** mit
   Speichern, Laden und „Raumplan als PDF“, darunter die **Reiter**), der Plan
   in voller Breite dazwischen, unten die Fußleiste mit Ansicht/Zoom und dem
   Stand des Rasters. Ein Reiter ist die **Raumliste**, die übrigen sind die
   Räume (in Klammern ihre Sitzplätze).

   **Bearbeitet wird ein Raum nach dem anderen:** Nebeneinander wären ein
   Hörsaal mit 44 × 32 Feldern und vier weitere Räume nicht zu überblicken.
   Gespeichert werden trotzdem immer alle Räume, je Raum eine Datei.

   Der Editor ist derselbe wie in Schritt 4 (Palette, verbundene Zellen,
   Ansicht/Zoom, Rückgängig, Drehen); dazu kommen:

   - **Fehlende Raster anlegen** – für jeden Raum der Liste ohne Raster einen
     Vorschlag erzeugen (Tische in Zweierblöcken mit Gang, Pult vorne, Tür
     hinten). Von Hand zu zeichnen ist nur noch, was davon abweicht.
   - **Plätze übernehmen** – die Platzzahl der Raumliste aus dem Raster setzen
     (die Tische zählen). Weicht beides ab, steht das in der Fußleiste –
     sonst meldet Schritt 4 später Teilnehmende „ohne Tisch“.
   - **Raumplan als PDF** – den Grundriss des gezeigten Raums als PDF-Seite
     (`66_E33.pdf`), gezeichnet von derselben Funktion wie der Sitzplan in
     Schritt 4 – nur ohne Belegung. Je Raum eine Datei: Hier arbeitet man an
     einem Raum und will genau dessen Plan ausdrucken oder weitergeben.
   - **Raster entfernen** – das Raster eines Raums verwerfen, ohne den Raum
     aus der Liste zu nehmen.

Liegt ein Projektordner vor, steht unter jeder Dateiauswahl, **welche Datei
von dort standardmäßig genutzt wird** – bei mehreren Kandidaten auch, welche
dadurch liegen bleiben, und wenn im erwarteten Ordner nichts liegt, steht das
ebenfalls dort.

Jeder Screen hat einen Button **„Beispieldaten laden“**, der den
anonymisierten Datensatz dieses Repos lädt – zum Ausprobieren und für den
E2E-Test (`.maestro/durchlauf.yaml`, siehe `.maestro/README.md`).

### Text der Schreiben (Schritt 2 und 4)

Was in den erzeugten PDFs steht, ändert sich jedes Semester – ein anderer
Hinweis, eine andere Uhrzeit, ein anderer Ton. Der Text ist deshalb kein
Quelltext, sondern eine **Vorlage**: In Schritt 2 („Text anpassen“) und in
Schritt 4 („Text der PDFs anpassen“) öffnet sich ein Blatt mit dem Text als
Markdown, darunter eine **Vorschau mit echten Daten** – der ersten Person der
Liste, sonst einer erfundenen.

- **Platzhalter** in spitzen Klammern werden je Person ersetzt:
  `<Vorname>`, `<Nachname>`, `<Matrikelnummer>`, `<E-Mail>`, in Schritt 4
  zusätzlich `<Raum>`, `<Sitzplatznummer>` und `<Zeit>`. Ein Klick auf den
  Platzhalter setzt ihn an der Cursorstelle ein. Was nicht bekannt ist, bleibt
  im PDF stehen – ein `<Vornmae>` soll auffallen und nicht ein Feld still
  leeren.
- **Markdown**, so viel wie ein Anschreiben braucht: `#`/`##`/`###` für
  Überschriften, `**fett**`, `*kursiv*`, `- ` und `1. ` für Aufzählungen,
  `---` für eine Trennlinie. Anders als sonst in Markdown beginnt **jede Zeile
  eine neue Zeile**; eine Leerzeile ist ein Abstand.
- Der Text wird im Projekt unter `Vorlagen/` gespeichert (`zulassung_vorlage.md`,
  `sitzplatz_vorlage.md`) und ist damit in der ZIP und nach dem Neuladen
  wieder da. „Auf Standardtext zurücksetzen“ holt den Anfangstext zurück.

### Projektaufbau (Yarn Workspaces)

```
packages/core   Fachlogik als reines TypeScript – läuft im Browser UND in Node
                (CSV/Excel-Parsing, VIPS-Auswertung, Zulassungsprüfung,
                Raumzuteilung, PDF/ZIP-Erzeugung) + Jest-Tests
apps/web        Expo-Web-App (React Native Web) mit den fünf Screens
```

Die Trennung ist Absicht: `packages/core` hat keine UI-Abhängigkeiten und kann
später unverändert in einen Node-Server eingebunden werden.

### Automatische Prüfungen (GitHub Actions)

| Workflow | Wann | Was |
|---|---|---|
| `test.yml` | jeder Push, jeder Pull Request | Jest-Tests der Fachlogik und Typecheck beider Pakete |
| `deploy-web.yml` | Push auf `main` | Tests, Typecheck, Web-Export und Veröffentlichung auf GitHub Pages |
| `data-clumps.yml` | Push auf `main`, manuell | Data-Clumps-Analyse; Report und Badge landen unter `reports/` |

Die drei Banner oben in dieser Datei zeigen den Stand: zweimal der Zustand des
Workflows, einmal die Anzahl der gefundenen Data Clumps.

### Data Clumps (`reports/`)

[Data Clumps](https://de.wikipedia.org/wiki/Data_Clump) sind Gruppen von
Feldern oder Parametern, die immer wieder gemeinsam auftauchen und eher ein
eigenes Objekt sein sollten. Der Workflow `data-clumps.yml` prüft das nach
jedem Push auf `main` mit dem
[data-clumps-doctor](https://github.com/NilsBaumgartner1994/data-clumps-doctor)
und schreibt das Ergebnis zurück ins Repository:

```
reports/data-clumps-doctor/data-clumps.json    vollständiger Report
reports/data-clumps-doctor/badges/data-clumps.svg   Badge für diese README
```

Ändert sich das Ergebnis, legt der Workflow zusätzlich ein Issue mit den
größten Fundstellen an (und schließt das vorherige). Der aktuelle Stand: 22
Data Clumps, davon 20 in `packages/core/src/types.ts` – dort teilen sich
`Zulassung`, `Anmeldung`, `Sitzplatz` und Co. dieselben Personenfelder.

Lokal ausführen:

```bash
git clone https://github.com/NilsBaumgartner1994/data-clumps-doctor /tmp/dcd
cd /tmp/dcd && yarn install && yarn build && cd -
node /tmp/dcd/build/ignoreCoverage/cli.js \
  --source_type typescript --commit_selection current \
  --output reports/data-clumps-doctor/data-clumps.json \
  --path_to_project "$PWD" --relative_path_to_source_folder_in_project .
```

### Deployment (GitHub Pages)

Jeder Push auf `main` baut die App und veröffentlicht sie auf GitHub Pages
(`.github/workflows/deploy-web.yml`). Einmalig in den Repo-Einstellungen
unter *Pages* die Source „GitHub Actions“ wählen. Lokaler Export:

```bash
yarn export:web                                   # apps/web/dist/
EXPO_BASE_URL=/exam-manager yarn export:web       # mit Pages-Basispfad
```

## Roadmap

1. **Anonymisierung & Dokumentation** – erledigt: Beispieldatensatz, READMEs.
2. **TypeScript-Web-Tool** – in Arbeit: Workspace, Fachlogik in
   `packages/core` (mit Jest-Tests), Expo-Web-App mit den fünf Screens,
   GitHub-Pages-Deployment, Maestro-E2E-Test.
3. **Python-Skripte ablösen** – sobald die App den kompletten Workflow
   abdeckt, bleiben die Skripte nur noch als Referenz erhalten.

Details und Konventionen für die Weiterentwicklung: [AGENTS.md](AGENTS.md).
