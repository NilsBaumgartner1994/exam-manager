#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import argparse
import csv
import os
import shutil
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib.utils import simpleSplit


def parse_args():
    parser = argparse.ArgumentParser(
        description="Erzeugt Klausur-Informations-PDFs aus Raum- und Zeitzuordnungen."
    )
    parser.add_argument(
        "--input",
        required=True,
        help="Pfad zur CSV-Datei studierendeZuRaumUndZeitZuordnung.csv"
    )
    parser.add_argument(
        "--output",
        required=True,
        help="Output-Ordner für die generierten PDFs"
    )
    return parser.parse_args()


def recreate_output_dir(path: str):
    if os.path.exists(path):
        shutil.rmtree(path)
    os.makedirs(path)


def generate_pdf(
    output_dir: str,
    vorname: str,
    matrikelnummer: str,
    raum: str,
    sitzplatznummer: str,
    reservierte_zeit: str
):
    filename = os.path.join(output_dir, f"{matrikelnummer}.pdf")
    c = canvas.Canvas(filename, pagesize=A4)
    width, height = A4

    x_margin = 50
    y_start = height - 80
    max_width = width - 2 * x_margin

    # ---------------- Normaler Text ----------------
    normal_text = f"""
Klausur Information

Liebe/r {vorname},

Sie haben sich für die Klausur angemeldet. Bitte beachten Sie folgende Informationen:

- Um an der Prüfung teilnehmen zu können, müssen Sie unbedingt Ihr Stud.IP-Login (User und Passwort) auswendig wissen.
  Tipp: Passen Sie Ihr Passwort ggf. vor der Prüfung temporär so an, dass Sie es sich sicher merken können.
- Bitte halten Sie zu Beginn und während der Prüfung Ihren Studierendenausweis / Ihre Immatrikulationsbescheinigung
  (und ggf. den EXA-Anmeldenachweis) bereit.
- Bitte kommen Sie mit etwas zeitlichem Vorlauf zum Prüfungsraum und planen Sie am Ende zusätzliche Zeit ein,
  da am Anfang etwas Zeit für Organisatorisches benötigt wird.

Datum / Gruppe / Zeiten:
{reservierte_zeit}

Raum:
{raum}
""".strip()

    c.setFont("Helvetica", 11)
    lines = simpleSplit(normal_text, "Helvetica", 11, max_width)

    text_object = c.beginText(x_margin, y_start)
    text_object.setLeading(14)

    for line in lines:
        text_object.textLine(line)

    c.drawText(text_object)

    # ---------------- Sitzplatznummer (groß, fett, deutlich) ----------------
    c.setFont("Helvetica-Bold", 18)

    y_position = text_object.getY() - 30

    c.drawString(
        x_margin,
        y_position,
        f"SITZPLATZNUMMER: {sitzplatznummer}"
    )

    c.showPage()
    c.save()


def main():
    args = parse_args()

    recreate_output_dir(args.output)

    with open(args.input, newline="", encoding="utf-8") as csvfile:
        reader = csv.DictReader(csvfile, delimiter=";")

        required_fields = {
            "Vorname",
            "Matrikelnummer",
            "Raum",
            "ReservierteZeit",
            "Sitzplatznummer",
        }

        if not required_fields.issubset(reader.fieldnames):
            raise ValueError(
                f"CSV muss folgende Spalten enthalten: {', '.join(required_fields)}"
            )

        for row in reader:
            generate_pdf(
                args.output,
                row["Vorname"].strip(),
                row["Matrikelnummer"].strip(),
                row["Raum"].strip(),
                row["Sitzplatznummer"].strip(),
                row["ReservierteZeit"].strip(),
            )


if __name__ == "__main__":
    main()
