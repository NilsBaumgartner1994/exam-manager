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
        description="Erzeugt Klausurzulassungs-PDFs aus einer CSV-Datei."
    )
    parser.add_argument(
        "--mitZulassungMitMail",
        required=True,
        help="Pfad zur CSV-Datei mit Zulassung und E-Mail"
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


def generate_pdf(output_dir, nachname, vorname, matrikelnummer, email):
    filename = os.path.join(output_dir, f"{matrikelnummer}.pdf")
    c = canvas.Canvas(filename, pagesize=A4)
    width, height = A4

    text = (
        "Dies ist eine automatisch generierte Datei und soll Sie darüber informieren, "
        f"dass Sie {vorname} {nachname} {matrikelnummer} {email} "
        "zur Klausur zugelassen sind."
    )

    x_margin = 50
    y_start = height - 100
    max_width = width - 2 * x_margin
    font_name = "Helvetica"
    font_size = 12
    line_height = 14

    c.setFont(font_name, font_size)

    lines = simpleSplit(
        text,
        font_name,
        font_size,
        max_width
    )

    text_object = c.beginText(x_margin, y_start)
    for line in lines:
        text_object.textLine(line)

    c.drawText(text_object)
    c.showPage()
    c.save()



def main():
    args = parse_args()

    recreate_output_dir(args.output)

    with open(args.mitZulassungMitMail, newline="", encoding="utf-8") as csvfile:
        reader = csv.DictReader(csvfile, delimiter=";")

        required_fields = {"Nachname", "Vorname", "Matrikelnummer", "E-Mail"}
        if not required_fields.issubset(reader.fieldnames):
            raise ValueError(
                f"CSV muss folgende Spalten enthalten: {', '.join(required_fields)}"
            )

        for row in reader:
            generate_pdf(
                args.output,
                row["Nachname"].strip(),
                row["Vorname"].strip(),
                row["Matrikelnummer"].strip(),
                row["E-Mail"].strip(),
            )


if __name__ == "__main__":
    main()
