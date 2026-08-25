#!/usr/bin/env python3
# encoding: utf-8

import csv
import subprocess
import sys
from argparse import ArgumentParser
from pathlib import Path

SEPARATOR = ";"


def create_search_csv(teilnehmende_csv, search_csv):
    """Teilnehmendenliste → search.csv"""
    with open(teilnehmende_csv, newline="", encoding="utf-8") as f_in, \
         open(search_csv, "w", newline="", encoding="utf-8") as f_out:

        reader = csv.DictReader(f_in, delimiter=SEPARATOR)
        writer = csv.writer(f_out, delimiter=SEPARATOR)

        for row in reader:
            writer.writerow([
                row["Nachname"].strip(),
                row["Vorname"].strip(),
                row["Matrikelnummer"].strip()
            ])


def run_check_permission(python_exec, zulassungen, search_csv, out_csv):
    zulassungen_path = Path(zulassungen).resolve()
    check_script = zulassungen_path / "checkPermissions.py"

    if not check_script.exists():
        raise FileNotFoundError(
            f"checkPermissions.py nicht gefunden in {zulassungen_path}"
        )

    cmd = [
        python_exec,
        str(check_script),
        "--display", "yes",
        "--out", str(Path(out_csv).resolve()),
        str(Path(search_csv).resolve()),
        str(zulassungen_path)
    ]

    subprocess.check_call(
        cmd,
        cwd=zulassungen_path
    )



def enrich_with_mail(teilnehmende_csv, ohne_mail_csv, mit_mail_csv):
    """Ergebnis wieder mit E-Mail anreichern"""
    mail_lookup = {}

    with open(teilnehmende_csv, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f, delimiter=SEPARATOR)
        for row in reader:
            key = (
                row["Nachname"].strip(),
                row["Vorname"].strip(),
                row["Matrikelnummer"].strip()
            )
            mail_lookup[key] = row["E-Mail"].strip()

    with open(ohne_mail_csv, newline="", encoding="utf-8") as f_in, \
         open(mit_mail_csv, "w", newline="", encoding="utf-8") as f_out:

        reader = csv.reader(f_in, delimiter=SEPARATOR)
        writer = csv.writer(f_out, delimiter=SEPARATOR)

        writer.writerow(["Nachname", "Vorname", "Matrikelnummer", "E-Mail"])

        for row in reader:
            key = (row[0], row[1], row[2])
            mail = mail_lookup.get(key, "")
            writer.writerow([row[0], row[1], row[2], mail])


def main():
    parser = ArgumentParser(description="Zulassungs-Pipeline mit checkPermission.py")

    parser.add_argument("--teilnehmende", required=True,
                        help="CSV-Datei der Teilnehmenden")
    parser.add_argument("--zulassungen", required=True,
                        help="Ordner oder Dateien mit Zulassungsdaten")
    parser.add_argument("--out-ohne-mail", required=True,
                        help="Ausgabedatei ohne E-Mail")
    parser.add_argument("--out-mit-mail", required=True,
                        help="Ausgabedatei mit E-Mail")

    parser.add_argument("--tmp-search", default="search.csv",
                        help="Temporäre Search-CSV (Default: search.csv)")
    parser.add_argument("--check-script", default="checkPermission.py",
                        help="Pfad zu checkPermission.py")
    parser.add_argument("--python", default=sys.executable,
                        help="Python-Interpreter für checkPermission.py")

    args = parser.parse_args()

    print("1) Erzeuge Search-CSV")
    create_search_csv(args.teilnehmende, args.tmp_search)

    print("2) Starte checkPermissions.py")
    run_check_permission(
        args.python,
        args.zulassungen,
        args.tmp_search,
        args.out_ohne_mail
    )


    print("3) Reichere Ergebnis mit E-Mail an")
    enrich_with_mail(
        args.teilnehmende,
        args.out_ohne_mail,
        args.out_mit_mail
    )

    print("Fertig.")
    print(f" - {args.out_ohne_mail}")
    print(f" - {args.out_mit_mail}")


if __name__ == "__main__":
    main()
