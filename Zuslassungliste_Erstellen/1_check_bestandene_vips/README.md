# 1. Wer hat die VIPS bestanden?

Ermittelt aus der VIPS-Notenliste, wer in diesem Jahr die Zulassung **neu**
erworben hat, und reichert das Ergebnis über den Stud.IP-Export mit E-Mail-
Adressen an.

## Eingaben

- `Notenliste.csv` – Punkte-Export aus VIPS (`Nachname;Vorname;Kennung;Matrikelnr.;<Aufgabenblätter…>;Summe`,
  zweite Zeile enthält die Maximalpunktzahlen)
- `Teilnehmendenexport_<Veranstaltung>.csv` – Teilnehmendenexport aus Stud.IP

## Aufruf

```bash
python3 checkPermissionVips.py \
  --input_vips_notenliste Notenliste.csv \
  --input_studip_liste Teilnehmendenexport_Beispielveranstaltung.csv \
  --output ./tutor_vergisst_punkte/vips_output.csv \
  --min_punkte_pro_blatt 30 \
  --min_blaetter_bestehen 3
```

Ohne `--min_punkte_pro_blatt` / `--min_blaetter_bestehen` fragt das Skript
interaktiv nach. Ergebnis: `Nachname;Vorname;Matrikelnummer;E-Mail`.

Diese Datei anschließend als `<kurs><jahr>_zulassungen.csv` nach `../../Zulassungen/`
kopieren – damit ist die Zulassung dauerhaft dokumentiert.

## Wenn ein Tutor Punkte nachträgt

`tutor_vergisst_punkte/` vergleicht zwei Läufe und liefert die Studierenden,
die erst im zweiten Lauf bestanden haben – nur diese müssen noch benachrichtigt
werden:

```bash
cd tutor_vergisst_punkte
python3 generate_difference.py \
  --input_before vips_output_vorher.csv \
  --input_after  vips_output.csv \
  --output_added added.csv
```
