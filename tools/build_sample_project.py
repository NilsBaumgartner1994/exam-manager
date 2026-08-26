#!/usr/bin/env python3
# encoding: utf-8
"""
Baut den Beispiel-Projektordner `Beispielprojekt/` aus den Beispieldaten des
Repos zusammen.

`Beispielprojekt/` zeigt, wie ein Projektordner für den Exam Manager aussieht:
Jede Eingabedatei liegt in dem Ordner, in dem die App sie sucht
(`PROJEKT_SCHEMA` in `packages/core/src/projekt.ts`). Der Ordner lässt sich auf
der Startseite direkt auswählen.

Reihenfolge nach Änderungen am Datensatz (siehe AGENTS.md):

    python3 tools/generate_sample_data.py    # + Pipeline laut README
    python3 tools/build_sample_project.py
    python3 tools/sync_sample_data_to_app.py
"""

import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ZIEL = ROOT / "Beispielprojekt"

VIPS = ROOT / "Zuslassungliste_Erstellen" / "1_check_bestandene_vips"
RAUM = ROOT / "Zuslassungliste_Erstellen" / "4_MailRaumZuordnung" / "2_raum_zuteilung_erstellen"

# Eingabedateien: Quelle -> Pfad im Projektordner. Die Zielordner sind exakt
# die des Schemas; wer hier etwas ändert, ändert auch PROJEKT_SCHEMA.
DATEIEN = [
    (ROOT / "Zulassungen" / "check.xlsx",
     "0_Input_Klausuranmeldungen/klausuranmeldungen_beispiel.xlsx"),
    (VIPS / "Teilnehmendenexport_Beispielveranstaltung.csv",
     "0_Input_Kurs_Teilnehmer_Studip_Liste/Teilnehmendenexport_Beispielveranstaltung.csv"),
    (VIPS / "Notenliste.csv",
     "0_Input_Vips_Notenliste/Notenliste.csv"),
    (ROOT / "Zulassungen" / "swe++24_zulassungen.csv",
     "Zulassungen/swe++24_zulassungen.csv"),
    (ROOT / "Zulassungen" / "pv2025_zulassungen.csv",
     "Zulassungen/pv2025_zulassungen.csv"),
    (RAUM / "raeume.csv", "Raeume/raeume.csv"),
]

# Die Raster liegen je Raum in einer eigenen Datei (siehe raumschema.ts) und
# behalten ihren Namen: Raeume/01_E01.csv, Raeume/94_E01.csv, ...
RAUMSCHEMATA = sorted((RAUM / "raumschema").glob("*.csv"))

# Ordner, die die App selbst füllt: leer, aber mit Hinweis – ein leerer Ordner
# überlebt Git nicht.
EXPORT_ORDNER = {
    "2_Zulassungs_PDFs_Export": (
        "Hier legt Schritt 2 die Zulassungs-PDFs ab – je Matrikelnummer eines.\n\n"
        "Beim erneuten Erzeugen leert die App diesen Ordner zuerst: Ein PDF aus einem\n"
        "früheren Lauf gehört zu einem Stand, den es nicht mehr gibt.\n\n"
        "Im Repository liegen hier keine PDFs – sie enthalten Personendaten.\n"
    ),
    "3_Klausur_Teilnehmende_Export": (
        "Hier legt Schritt 3 die geprüften Anmeldungen ab:\n"
        "`allowedStudents.csv` (angemeldet und zugelassen) und\n"
        "`notAllowedStudents.csv` (angemeldet, aber ohne Zulassung).\n"
    ),
    "4_Raumzuteilung_Export": (
        "Hier legt Schritt 4 den Sitzplan und die Raumbelegung dieser Klausur ab.\n"
        "Die leeren Raumraster bleiben in `Raeume/` – sie gelten für jedes Jahr.\n"
    ),
}

LIESMICH = """# Beispiel-Projektordner

So sieht ein Projektordner für den [Exam Manager](../README.md) aus. Auf der
Startseite der App „Projektordner auswählen“ anklicken und diesen Ordner
wählen – die Schritte holen sich ihre Eingaben dann von selbst.

**Der Ordner entscheidet.** Eine Datei wird nur gelesen, wenn sie im
vorgesehenen Ordner mit der passenden Endung liegt; alles andere zeigt die App
als „nicht zugeordnet“ an und rührt es nicht an.

| Ordner | Dateien | Was hineingehört |
|---|---|---|
| 0_Input_Klausuranmeldungen/ | *.xlsx | Anmeldungen zur Klausur, wie sie das Prüfungsamt schickt |
| 0_Input_Kurs_Teilnehmer_Studip_Liste/ | *.csv | Teilnehmendenexport der Veranstaltung aus Stud.IP |
| 0_Input_Vips_Notenliste/ | *.csv | Notenliste aus VIPS mit den Punkten der Aufgabenblätter |
| Zulassungen/ | *zulassungen*.csv | je Jahr eine Liste der Zugelassenen |
| Raeume/ | *.csv | Raumliste und je Raum ein leeres Raster, jedes Jahr wiederverwendbar |
| 2_Zulassungs_PDFs_Export/ | *.pdf | erzeugte Zulassungs-PDFs (Schritt 2) |
| 3_Klausur_Teilnehmende_Export/ | *.csv | Angemeldete mit und ohne Zulassung (Schritt 3) |
| 4_Raumzuteilung_Export/ | *.csv | Sitzplan und Raumbelegung (Schritt 4) |

Die Export-Ordner füllt die App. Der Browser darf nicht auf die Festplatte
zurückschreiben – deshalb gibt es auf jedem Screen „Aktualisiertes Projekt
herunterladen“: die ZIP entpacken und den eigenen Ordner damit ersetzen.

## Nur erfundene Daten

Dieser Ordner gehört zum öffentlichen Beispiel-Datensatz des Repos (siehe
README). Ein echter Projektordner enthält Personendaten und hat in einem
öffentlichen Repository nichts verloren.

Erzeugt von `tools/build_sample_project.py` – nicht von Hand bearbeiten.
"""


def main():
    if ZIEL.exists():
        shutil.rmtree(ZIEL)

    for quelle, ziel in DATEIEN + [(q, f"Raeume/{q.name}") for q in RAUMSCHEMATA]:
        pfad = ZIEL / ziel
        pfad.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(quelle, pfad)

    for ordner, hinweis in EXPORT_ORDNER.items():
        pfad = ZIEL / ordner
        pfad.mkdir(parents=True, exist_ok=True)
        (pfad / "LIESMICH.md").write_text(f"# {ordner}\n\n{hinweis}", encoding="utf-8")

    (ZIEL / "LIESMICH.md").write_text(LIESMICH, encoding="utf-8")
    print(
        f"geschrieben: {ZIEL.relative_to(ROOT)}/ "
        f"({len(DATEIEN) + len(RAUMSCHEMATA)} Dateien + {len(EXPORT_ORDNER)} Export-Ordner)"
    )


if __name__ == "__main__":
    main()
