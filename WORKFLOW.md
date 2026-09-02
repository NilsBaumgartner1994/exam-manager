# Prüfungs-Workflow

Der jährlich wiederkehrende Ablauf einer Klausur – von den Anmeldungen bis zum
Sitzplan. Die Beispieldaten im Repository bilden genau diesen Ablauf ab
(siehe [README.md](README.md)).

Dieselben Schritte gibt es in der Web-App (`yarn web`) und auf der
Kommandozeile (`yarn 1_vips …` bis `yarn 5_raeume …`, siehe README unter
„Kommandozeile“); die Python-Skripte unten sind die fachliche Referenz.

## 1. Anmeldungen des Prüfungsamts einlesen

- Warten, bis das Prüfungsamt die Prüfungsanmeldungen (HIS-Export) zusendet.
- Export nach `Zulassungen/check.xlsx` legen und in CSV wandeln:
  ```bash
  cd Zulassungen
  python3 1_transform_exel_to_csv.py     # check.xlsx -> check.csv
  ```
- Auf UTF-8 achten, damit Umlaute (z. B. „Schrödinger“) korrekt ankommen.
  Beim Export aus Excel ist das oft nicht der Fall.
  - Mac/Sublime: *Save with Encoding: UTF-8*

## 2. Neue Zulassungen aus den Übungspunkten ermitteln

- Alle Bepunktungen aus VIPS exportieren (`Notenliste.csv`).
- Wer in diesem Jahr die Zulassung neu erhalten hat:
  `Zuslassungliste_Erstellen/1_check_bestandene_vips/README.md`
- Das Ergebnis (`vips_output.csv`) als `<kurs><jahr>_zulassungen.csv` in den
  Ordner `Zulassungen/` kopieren – dort liegt der Bestand aller Jahre.
- Alle zugelassenen Studierenden informieren:
  `Zuslassungliste_Erstellen/2_mail_versenden_bestandene_vips_individuell/README.md`
  (Option B: Stud.IP „Klausureinsicht“ – unsichtbarer Dateiordner mit „Zugriff
  auf Dateien per Link“, Werkzeug aktivieren, Reiter „Klausur Zulassung“, im
  Werkzeug den Ordner mit den PDFs auswählen; jede Person sieht nur die Datei
  ihrer Matrikelnummer)
- Anschließend Rundmail an alle: `Zuslassungliste_Erstellen/3_rundmail_an_alle/README.md`

## 3. Anmeldungen gegen den Zulassungsbestand prüfen

```bash
cd Zulassungen
python3 checkPermissions.py --out ./allowedStudents.csv    --display yes ./check.csv
python3 checkPermissions.py --out ./notAllowedStudents.csv --display no  ./check.csv
```

- `allowedStudents.csv` – angemeldet **und** zugelassen
- `notAllowedStudents.csv` – angemeldet, aber **ohne** Zulassung (anschreiben!)

## 4. Sitzplan erstellen

Für alle angemeldeten und zugelassenen Studierenden eine Raum-PDF erzeugen:
`Zuslassungliste_Erstellen/4_MailRaumZuordnung/2_raum_zuteilung_erstellen/README.md`

Verteilt wird auf die Räume der Klausur – wie viele Plätze ein Raum hat, sind
die Tische in seinem Raster. Reichen sie nicht, kommt ein Raum dazu.

Die Sitzplatz-PDFs gehen denselben Weg wie die Zulassungen: unsichtbarer
Dateiordner, Werkzeug „Klausureinsicht“, Reiter diesmal „Klausur Sitzplatz“.

## 5. Klausurdruck

`allowedStudents.csv` in `teilnehmer.csv` umbenennen und in den Überordner des
LaTeX-Projekts legen, dann `make mult`.
