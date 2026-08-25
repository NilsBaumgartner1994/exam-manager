# 4.2 Raum- und Sitzplatzzuteilung

Verteilt die zugelassenen Teilnehmenden auf die reservierten Räume und vergibt
Sitzplatznummern (beginnend bei 1001), sortiert nach Raum/Zeit und Nachname.

## Eingaben

- `result.csv` – Ergebnis aus Schritt 3 (`allowedStudents.csv`), `Nachname;Vorname;Matrikelnummer`
- `../1_Teilnehmer_erzeugen_oder_laden/teilnehmer.csv` – Stud.IP-Export (liefert die E-Mail)
- `raeume.csv` – `Raum;Plätze;ReservierteZeit`

Beispiel `raeume.csv`:

```
Raum;Plätze;ReservierteZeit
94/E01;4;01.02.2026 Gruppe 1: ca. 09:15 Uhr = Einlassstart / 09:30 Uhr (s.t.) = Einlassschluss (fix)
```

Plätze je Raum hängen vom Abstand ab, z. B. 94/E01: 17 Plätze mit Abstand
(Klausur), 28 Plätze direkt nebeneinander (Probeklausur).

## Zuteilung erzeugen

```bash
python3 createRoomAssignment.py \
  --teilnehmer ./result.csv \
  --studip ../1_Teilnehmer_erzeugen_oder_laden/teilnehmer.csv \
  --raeume raeume.csv \
  --output studierendeZuRaumUndZeitZuordnung.csv
```

Das Skript fragt nach dem Verteilmodus: `1` füllt die Räume nacheinander,
`2` (Standard) verteilt gleichmäßig nach Auslastung.

Die Spalte `Anfang_Nachname` enthält das kürzeste eindeutige Namenspräfix –
praktisch für Aushänge am Raum. `Anwesend` bleibt leer und dient als
Ankreuzspalte für die Anwesenheitsliste.

## PDFs für die Studierenden

```bash
python3 2_generate_studip_pdfs.py \
  --input ./studierendeZuRaumUndZeitZuordnung.csv \
  --output ./pdfs
```

Erzeugt je Person `<Matrikelnummer>.pdf` mit Raum, Sitzplatz und Einlasszeit –
Upload wie in Schritt 2, Option B.
