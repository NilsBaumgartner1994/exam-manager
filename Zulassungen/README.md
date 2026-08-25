# Zulassungen – Bestand aller Jahre

Dieser Ordner ist das Gedächtnis der Veranstaltung: Für jedes Jahr liegt hier
eine Liste der Studierenden, die die Klausurzulassung erworben haben. Eine
einmal erworbene Zulassung bleibt gültig, deshalb wird immer gegen **alle**
Listen geprüft.

## Dateien

| Datei | Inhalt |
|---|---|
| `<kurs><jahr>_zulassungen.csv` | Zulassungsbestand eines Jahres: `Nachname;Vorname;Matrikelnummer;E-Mail` |
| `check.xlsx` / `check.csv` | Prüfungsanmeldungen des Prüfungsamts (HIS-Export) |
| `result.csv` | Beispielergebnis eines Laufs (= `allowedStudents.csv`) |

Nur Dateien mit `zulassungen` im Namen gelten als Zulassungsbestand –
`check.csv` und `result.csv` werden beim Prüfen ignoriert.

## Anmeldungen einlesen

`check.xlsx` (HIS-Export) nach `check.csv` wandeln:

```bash
python3 1_transform_exel_to_csv.py
```

Sicherstellen, dass `check.csv` UTF-8 ist und Umlaute wie „ä“ korrekt kodiert
sind – beim Export aus Excel ist das oft nicht der Fall.

## Zulassungen prüfen

```bash
python3 checkPermissions.py --display yes --out ./allowedStudents.csv    ./check.csv
python3 checkPermissions.py --display no  --out ./notAllowedStudents.csv ./check.csv
```

`--display yes` listet die Angemeldeten **mit** Zulassung, `--display no` die
**ohne**. Ohne weitere Pfadangabe werden alle `*zulassungen*.csv` dieses
Ordners als Datenbasis benutzt.

## Zwei Listen vergleichen

```bash
python3 checkDifferences.py ./check.csv ./result.csv
```
