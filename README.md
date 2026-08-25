# Exam Manager

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
```

## Ordnerstruktur

```
Zulassungen/                       Zulassungsbestand aller Jahre + Prüfung der Anmeldungen
Zuslassungliste_Erstellen/
  1_check_bestandene_vips/         Wer hat dieses Jahr die Übungen bestanden?
  2_mail_versenden_.../            Studierende über ihre Zulassung informieren
  3_rundmail_an_alle/              Vorlage für die Rundmail
  4_MailRaumZuordnung/             Teilnehmendenliste, Raum- und Sitzplatzzuteilung
tools/generate_sample_data.py      Erzeugt den anonymisierten Beispiel-Datensatz
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
| Raumliste | `Raum;Plätze;ReservierteZeit` |
| Raumschema (`raumschema.csv`) | Raster statt Kopfzeile: `Raum;<Name>` beginnt einen Raum, jede weitere Zeile ist eine Reihe im Raum. Zellen: `T` Tisch, `D` Tür, `W` Wand, `P` Pult, `.` frei |
| Raumbelegung (`raumbelegung.csv`) | `Raum;Zeile;Spalte;Sitzplatznummer;Matrikelnummer;Nachname;Vorname;Reserviert;Vorgabe` (Sitzplatznummer, Nachname und Vorname stehen nur zur Lesbarkeit darin und werden beim Einlesen ignoriert) |

Ein Raumschema bildet den Aufbau des Raumes direkt ab und lässt sich deshalb
auch in Excel bearbeiten – so sieht `raumschema.csv` der Beispieldaten aus:

```
Raum;94/E01
P;.;.;.
.;T;.;T
.;T;.;T
D;.;.;.
```

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
7 zugelassene Angemeldete, 1 Person ohne Zulassung, 7 Sitzplätze in 2 Räumen.

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

Die Startseite zeigt vier Kacheln entlang des Workflows:

1. **VIPS-Punkte auswerten** – Notenliste + Teilnehmendenexport hochladen,
   Kriterien eingeben (Min. Punkte pro Blatt, Anzahl Blätter), Ergebnis als
   Zulassungs-CSV herunterladen (Dateiname frei wählbar, Default
   `<Veranstaltung>_<Jahr>_zulassungen.csv`).
2. **Zulassungs-PDFs generieren** – Zulassungsordner + Teilnehmendenexport
   laden, je Person mit Zulassung ein `<Matrikelnummer>.pdf` erzeugen und
   gesammelt als ZIP herunterladen (für die Stud.IP-„Klausureinsicht“).
3. **Klausur-Anmeldungen prüfen** – HIS-Export (`check.xlsx`) gegen den
   Zulassungsbestand prüfen; Zugelassene/Nicht-Zugelassene anzeigen und als
   CSV herunterladen.
4. **Raumzuteilung & Sitzplan** – Teilnehmer-CSV aus Schritt 3 laden, Räume
   modellieren (und als Blanko-CSV speichern), Sitzplätze ab Startnummer
   (Default 1001) vergeben; Ansichten: Aushang (anonym), Dozent (nach
   Sitzplatz), Tutor (nach Nachname), Räume/Aushänge je Raum; Export als CSV,
   Sitzplatz-PDFs (ZIP) und alle Aushänge als PDF über den Druckdialog.

   **Sitzplan im Raum:** Zu jedem Raum lässt sich ein Raster hinterlegen, das
   den Aufbau des Raumes abbildet – wo Tische stehen, wo Tür, Wand und Pult
   sind (`raumschema.csv`, siehe unten). Auf diesem Raster werden die
   Studierenden platziert:

   - **Platzieren** – Person antippen, Zieltisch antippen; sitzt dort jemand,
     tauschen die beiden.
   - **Reserve** – Tische frei halten; wer dadurch verdrängt wird, rückt auf
     einen freien Tisch nach (bleibt keiner übrig, nennt die App die Person).
   - **Vorgabe** – eine Person fest auf ihren Platz binden; sie bleibt dort
     auch bei „Sitzplan neu verteilen“.
   - **Raum bearbeiten** – Zellenart wählen und Zellen antippen, Zeilen und
     Spalten hinzufügen oder entfernen.
   - **Drehen** – die Ansicht je Raum um 90° drehen (vier Richtungen), damit
     sie zur eigenen Blickrichtung im Raum passt. Gedreht wird nur die
     Darstellung; die gespeicherten Positionen und die Sitzplatznummern
     bleiben gleich.

   Die Sitzplatznummer gehört zum **Tisch** (fortlaufend über alle Räume in
   Lesereihenfolge des Rasters), nicht zur Person: Wer umgesetzt wird, bekommt
   die Nummer des neuen Tisches. Raster und Belegung lassen sich als CSV
   speichern und wieder laden.

Jeder Screen hat einen Button **„Beispieldaten laden“**, der den
anonymisierten Datensatz dieses Repos lädt – zum Ausprobieren und für den
E2E-Test (`.maestro/durchlauf.yaml`, siehe `.maestro/README.md`).

### Projektaufbau (Yarn Workspaces)

```
packages/core   Fachlogik als reines TypeScript – läuft im Browser UND in Node
                (CSV/Excel-Parsing, VIPS-Auswertung, Zulassungsprüfung,
                Raumzuteilung, PDF/ZIP-Erzeugung) + Jest-Tests
apps/web        Expo-Web-App (React Native Web) mit den vier Screens
```

Die Trennung ist Absicht: `packages/core` hat keine UI-Abhängigkeiten und kann
später unverändert in einen Node-Server eingebunden werden.

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
   `packages/core` (mit Jest-Tests), Expo-Web-App mit den vier Screens,
   GitHub-Pages-Deployment, Maestro-E2E-Test.
3. **Python-Skripte ablösen** – sobald die App den kompletten Workflow
   abdeckt, bleiben die Skripte nur noch als Referenz erhalten.

Details und Konventionen für die Weiterentwicklung: [AGENTS.md](AGENTS.md).
