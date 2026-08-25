# 4.1 Teilnehmendenliste bereitstellen

`teilnehmer.csv` ist der Teilnehmendenexport aus Stud.IP und liefert in
Schritt 4.2 die E-Mail-Adressen zu den Matrikelnummern.

Falls nur eine schlanke Liste `Nachname;Vorname;Matrikelnummer` gebraucht wird
(nur Studierende, also Status `autor`):

```bash
python3 createSimulatedTeilnehmerListeFromStudIp.py \
  --studip ./teilnehmer.csv \
  --output ./teilnehmerSimulatedFromStudIp.csv \
  --status autor
```
