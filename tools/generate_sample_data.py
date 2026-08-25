#!/usr/bin/env python3
# encoding: utf-8
"""
Erzeugt den kompletten anonymisierten Beispiel-Datensatz dieses Repos.

Es werden ausschliesslich die *Eingangsdaten* der Pipeline erzeugt
(HIS-Export, VIPS-Notenliste, Stud.IP-Export, Zulassungslisten alter Jahre,
Raumliste). Alle abgeleiteten Dateien entstehen, indem die Skripte der
Pipeline darauf laufen -- siehe README.md.

Alle Personen sind frei erfunden (beruehmte Wissenschaftler:innen,
Vornamen alphabetisch A-J), Matrikelnummern zaehlen ab 1000001 hoch,
E-Mails sind <vorname>@test.de.

    python3 tools/generate_sample_data.py
"""

import csv
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ZUL = ROOT / "Zulassungen"
LST = ROOT / "Zuslassungliste_Erstellen"

SEP = ";"
PRUEFUNGSDATUM = "01.02.2026"
VERANSTALTUNG = "Beispielveranstaltung"

# --------------------------------------------------------------------------
# Personen
# --------------------------------------------------------------------------
# Lehrende und Tutor:innen stehen im Stud.IP-Export vor den Studierenden und
# sind am Status ("dozent"/"tutor") erkennbar. Sie haben keine Matrikelnummer.
STAFF = [
    dict(status="dozent", anrede="Frau", titel="Prof. Dr.-Ing.", titel_nach="",
         vorname="Ada", nachname="Lovelace", kennung="alovelace"),
    dict(status="dozent", anrede="Herr", titel="", titel_nach="M. Sc.",
         vorname="Alan", nachname="Turing", kennung="aturing"),
    dict(status="tutor", anrede="Frau", titel="", titel_nach="",
         vorname="Grace", nachname="Hopper", kennung="ghopper"),
    dict(status="tutor", anrede="Herr", titel="", titel_nach="",
         vorname="Kurt", nachname="Goedel", kennung="kgoedel"),
]

# 10 Studierende, Vornamen alphabetisch, Matrikelnummern ab 1000001.
STUDENTS = [
    dict(vorname="Archimedes", nachname="Archi",       matrikel="1000001", geschlecht="M", anrede="Herr", kennung="aarchi",         studiengang="Informatik,Bachelor of Science,3"),
    dict(vorname="Blaise",     nachname="Pascal",      matrikel="1000002", geschlecht="M", anrede="Herr", kennung="bpascal",        studiengang="Informatik,Bachelor of Science,5"),
    dict(vorname="Charles",    nachname="Darwin",      matrikel="1000003", geschlecht="M", anrede="Herr", kennung="cdarwin",        studiengang="Wirtschaftsinformatik,Bachelor of Science,3"),
    dict(vorname="Dorothy",    nachname="Hodgkin",     matrikel="1000004", geschlecht="W", anrede="Frau", kennung="dhodgkin",       studiengang="Informatik,Bachelor of Science,1"),
    dict(vorname="Erwin",      nachname="Schrödinger", matrikel="1000005", geschlecht="M", anrede="Herr", kennung="eschroedinger",  studiengang="Informatik,Master of Science,1"),
    dict(vorname="Francis",    nachname="Crick",       matrikel="1000006", geschlecht="M", anrede="Herr", kennung="fcrick",         studiengang="Wirtschaftsinformatik,Bachelor of Science,7"),
    dict(vorname="Galileo",    nachname="Galilei",     matrikel="1000007", geschlecht="M", anrede="Herr", kennung="ggalilei",       studiengang="Informatik,Bachelor of Science,7"),
    dict(vorname="Hedy",       nachname="Lamarr",      matrikel="1000008", geschlecht="W", anrede="Frau", kennung="hlamarr",        studiengang="Cognitive Science,Bachelor of Science,5"),
    dict(vorname="Isaac",      nachname="Newton",      matrikel="1000009", geschlecht="M", anrede="Herr", kennung="inewton",        studiengang="Informatik,Bachelor of Science,3"),
    dict(vorname="Johannes",   nachname="Kepler",      matrikel="1000010", geschlecht="M", anrede="Herr", kennung="jkepler",        studiengang="Mathematik,Bachelor of Science,5"),
]

for p in STAFF + STUDENTS:
    p["email"] = p["vorname"].lower() + "@test.de"

BY_NAME = {p["nachname"]: p for p in STUDENTS}


def s(*nachnamen):
    """Studierende in der Reihenfolge der angegebenen Nachnamen."""
    return [BY_NAME[n] for n in nachnamen]


def alpha(people):
    """Alphabetisch nach Nachname (Umlaute normalisiert), wie in echten Exporten."""
    trans = str.maketrans({"Ä": "AE", "Ö": "OE", "Ü": "UE", "ä": "ae", "ö": "oe", "ü": "ue", "ß": "ss"})
    return sorted(people, key=lambda p: p["nachname"].translate(trans).lower())


# --------------------------------------------------------------------------
# Fachliche Szenarien des Beispiel-Datensatzes
# --------------------------------------------------------------------------
# VIPS-Punkte: bestanden = mind. 3 Blaetter mit mind. 30 Punkten.
# Ergebnis: Archi, Darwin, Hodgkin, Kepler, Newton, Schrödinger bestehen.
PUNKTE = {
    "Archi":       ["60", "48", "55", "50"],
    "Pascal":      ["30", "20", "25", "15"],   # zu wenig -> keine neue Zulassung
    "Darwin":      ["55", "40", "62", "48"],
    "Hodgkin":     ["70", "55", "68", "60"],
    "Schrödinger": ["48", "38", "52", "44"],
    "Crick":       ["20", "15", "", ""],       # abgebrochen
    "Galilei":     ["45", "25", "28", "10"],   # nur ein Blatt bestanden
    "Lamarr":      ["", "", "", ""],           # nicht teilgenommen
    "Newton":      ["65", "50", "60", "55"],
    "Kepler":      ["52", "45", "58", "40"],
}

# Zulassung aus einem frueheren Jahr (Altbestand)
ALTE_ZULASSUNGEN = s("Pascal", "Galilei", "Lamarr")

# Zur Klausur angemeldet (Export des Pruefungsamts); Kepler und Newton haben
# eine Zulassung, melden sich aber nicht an. Crick meldet sich ohne Zulassung an.
ANGEMELDET = alpha(s("Archi", "Crick", "Darwin", "Galilei", "Hodgkin",
                     "Lamarr", "Pascal", "Schrödinger"))

# Tutor:in hat bei Darwin die Punkte zunaechst vergessen
VIPS_BESTANDEN = alpha(s("Archi", "Darwin", "Hodgkin", "Kepler", "Newton", "Schrödinger"))
VIPS_BESTANDEN_VORHER = [p for p in VIPS_BESTANDEN if p["nachname"] != "Darwin"]


# --------------------------------------------------------------------------
# Writer
# --------------------------------------------------------------------------
def write_rows(path, rows, header=None, bom=False, quote_all=False):
    path.parent.mkdir(parents=True, exist_ok=True)
    encoding = "utf-8-sig" if bom else "utf-8"
    quoting = csv.QUOTE_ALL if quote_all else csv.QUOTE_MINIMAL
    with open(path, "w", newline="", encoding=encoding) as f:
        w = csv.writer(f, delimiter=SEP, quoting=quoting, lineterminator="\n")
        if header:
            w.writerow(header)
        w.writerows(rows)
    print(f"  {path.relative_to(ROOT)}")


def zulassungsliste(path, people):
    write_rows(path, [[p["nachname"], p["vorname"], p["matrikel"], p["email"]] for p in people],
               header=["Nachname", "Vorname", "Matrikelnummer", "E-Mail"])


def studip_export(path):
    """Teilnehmendenexport aus Stud.IP: erst dozent/tutor, dann autor (= Studierende)."""
    header = ["Status", "Anrede", "Titel", "Vorname", "Nachname", "Titel nachgestellt",
              "Benutzername", "Adresse", "Telefonnr.", "E-Mail", "Anmeldedatum",
              "Matrikelnummer", "Studiengänge", "Position"]
    rows = []
    for i, p in enumerate(STAFF):
        rows.append([p["status"], p["anrede"], p["titel"], p["vorname"], p["nachname"],
                     p["titel_nach"], p["kennung"], "", "", p["email"],
                     "17.04.2025 09:37:46", "", "", str(i)])
    for i, p in enumerate(alpha(STUDENTS)):
        rows.append(["autor", p["anrede"], "", p["vorname"], p["nachname"], "",
                     p["kennung"], "", "", p["email"], "29.09.2025 15:43:38",
                     p["matrikel"], p["studiengang"], str(len(STAFF) + i)])
    write_rows(path, rows, header=header, quote_all=True)


def notenliste(path):
    """VIPS-Notenlisten-Export (mit BOM, wie aus VIPS heruntergeladen)."""
    header = ["Nachname", "Vorname", "Kennung", "Matrikelnr.",
              "PV - Aufgabenblatt 01", "PV - Aufgabenblatt 02",
              "PV - Aufgabenblatt 03", "PV - Aufgabenblatt 04 - Langzeit", "Summe"]
    rows = [["Maximalpunktzahl", "", "", "", "75", "60", "75", "75", "285"]]
    for p in alpha(STUDENTS):
        punkte = PUNKTE[p["nachname"]]
        summe = sum(int(x) for x in punkte if x) if any(punkte) else ""
        rows.append([p["nachname"], p["vorname"], p["kennung"], p["matrikel"],
                     *punkte, str(summe) if summe != "" else ""])
    write_rows(path, rows, header=header, bom=True)


def his_export(path_xlsx, path_csv):
    """Export des Pruefungsamts (HIS): xlsx + die daraus erzeugte csv."""
    from openpyxl import Workbook

    wb = Workbook()
    ws = wb.active
    ws.append([f"1.234 - {VERANSTALTUNG} (Veranstaltung) | Wintersemester 2025/26"])
    ws.append([])
    ws.append(["EXAM_CHECK_TOKEN", "00000000000000000000000000000000"])
    ws.append(["startHISsheet"])
    ws.append(["Matrikelnummer", "Nachname", "Vorname", "Geschlecht", "Studiengang",
               "Bewertung", "LP", "Status", "Vermerk", "Prf.-Datum", "Prf.-Form",
               "Prf.-Art", "PrüfungsNr.", "Examplan.id", "LockVersion"])
    for i, p in enumerate(ANGEMELDET):
        ws.append([p["matrikel"], p["nachname"], p["vorname"], p["geschlecht"],
                   p["studiengang"].split(",")[0], None, None, "AN", None,
                   PRUEFUNGSDATUM, "Klausur", "Prüfungsleistung", "12345678-INF",
                   str(3500000 + i), f"00000000-0000-0000-0000-{i:012d}=0,"])
    ws.append(["endHISsheet"])
    path_xlsx.parent.mkdir(parents=True, exist_ok=True)
    wb.save(path_xlsx)
    print(f"  {path_xlsx.relative_to(ROOT)}")

    # entspricht dem Ergebnis von 1_transform_exel_to_csv.py
    write_rows(path_csv, [[p["nachname"], p["vorname"], p["matrikel"]] for p in ANGEMELDET])


def raeume(path):
    header = ["Raum", "Plätze", "ReservierteZeit"]
    zeit1 = f"{PRUEFUNGSDATUM} Gruppe 1: ca. 09:15 Uhr = Einlassstart / 09:30 Uhr (s.t.) = Einlassschluss (fix)"
    zeit2 = f"{PRUEFUNGSDATUM} Gruppe 2: ca. 12:15 Uhr = Einlassstart / 12:30 Uhr (s.t.) = Einlassschluss (fix)"
    write_rows(path, [["94/E01", "4", zeit1], ["94/E03", "4", zeit2]], header=header)


def raumschema(path):
    """Raster der Raeume: T=Tisch, D=Tuer, W=Wand, P=Pult, .=frei.

    Bildet den Aufbau des Raumes ab (siehe packages/core/src/raumschema.ts) und
    ist bewusst je Raum anders geschnitten, damit das Drehen der Ansicht in der
    App sichtbar etwas aendert.
    """
    rows = [
        ["Raum", "94/E01"],
        ["P", ".", ".", "."],
        [".", "T", ".", "T"],
        [".", "T", ".", "T"],
        ["D", ".", ".", "."],
        ["Raum", "94/E03"],
        [".", ".", "P", "."],
        ["T", "T", ".", "."],
        ["T", "T", ".", "."],
        [".", ".", ".", "D"],
    ]
    write_rows(path, rows)


def main():
    print("Erzeuge anonymisierte Beispiel-Eingangsdaten:")

    # Zulassungsordner: Altbestand + Anmeldungen des Pruefungsamts
    zulassungsliste(ZUL / "swe++24_zulassungen.csv", alpha(ALTE_ZULASSUNGEN))
    his_export(ZUL / "check.xlsx", ZUL / "check.csv")

    # Schritt 1: VIPS
    notenliste(LST / "1_check_bestandene_vips" / "Notenliste.csv")
    studip = LST / "1_check_bestandene_vips" / f"Teilnehmendenexport_{VERANSTALTUNG}.csv"
    studip_export(studip)
    zulassungsliste(LST / "1_check_bestandene_vips" / "tutor_vergisst_punkte" / "vips_output_vorher.csv",
                    VIPS_BESTANDEN_VORHER)

    # Schritt 2 und 4 arbeiten auf demselben Stud.IP-Export
    for target in [LST / "2_mail_versenden_bestandene_vips_individuell" / f"Teilnehmendenexport_{VERANSTALTUNG}.csv",
                   LST / "4_MailRaumZuordnung" / "1_Teilnehmer_erzeugen_oder_laden" / "teilnehmer.csv"]:
        studip_export(target)

    # Schritt 4: Raeume
    raeume(LST / "4_MailRaumZuordnung" / "2_raum_zuteilung_erstellen" / "raeume.csv")
    raumschema(LST / "4_MailRaumZuordnung" / "2_raum_zuteilung_erstellen" / "raumschema.csv")

    print("Fertig. Abgeleitete Dateien entstehen ueber die Pipeline (siehe README.md).")


if __name__ == "__main__":
    main()
