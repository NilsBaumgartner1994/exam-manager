import csv
import argparse

# Argumente definieren
parser = argparse.ArgumentParser(description="Filtere Studierende basierend auf Aufgabenblattpunkten und füge E-Mails hinzu.")
parser.add_argument('--input_vips_notenliste', required=True, help='Pfad zur Eingabedatei der VIPS-Notenliste (CSV)')
parser.add_argument('--input_studip_liste', required=True, help='Pfad zur Stud.IP-Liste (CSV)')
parser.add_argument('--output', required=True, help='Pfad zur Ausgabedatei (CSV)')
parser.add_argument('--min_punkte_pro_blatt', type=float, help='Minimale Punktzahl pro Aufgabenblatt, um es zu bestehen')
parser.add_argument('--min_blaetter_bestehen', type=int, help='Minimale Anzahl an zu bestehenden Aufgabenblättern')

args = parser.parse_args()

# Eingabeparameter verarbeiten
input_vips_notenliste = args.input_vips_notenliste
input_studip_liste = args.input_studip_liste
output_file = args.output
min_punkte_pro_blatt = args.min_punkte_pro_blatt
min_blaetter_bestehen = args.min_blaetter_bestehen

# Eingabeparameter prüfen und ggf. interaktiv abfragen
if min_punkte_pro_blatt is None:
    min_punkte_pro_blatt = float(input("Bitte geben Sie die minimale Punktzahl pro Aufgabenblatt an (z. B. 50): "))

if min_blaetter_bestehen is None:
    min_blaetter_bestehen = int(input("Bitte geben Sie die minimale Anzahl zu bestehender Aufgabenblätter an: "))

# Stud.IP-Liste einlesen und Matrikelnummer-E-Mail-Mapping erstellen
matrikelnummer_email_map = {}
with open(input_studip_liste, 'r') as studip_csv:
    reader = csv.reader(studip_csv, delimiter=';')
    header = next(reader)  # Kopfzeile lesen
    print(header)
    matrikelnummer_index = header.index("Matrikelnummer")
    email_index = header.index("E-Mail")

    for row in reader:
        matrikelnummer = row[matrikelnummer_index].strip()
        email = row[email_index].strip()
        matrikelnummer_email_map[matrikelnummer] = email

# VIPS-Notenliste verarbeiten
with open(input_vips_notenliste, 'r') as input_csv:
    reader = csv.reader(input_csv, delimiter=';')

    # Lesen der Kopfzeile
    header = next(reader)
    aufgabenblatt_indices = [
    i for i, col in enumerate(header)
        if "Aufgabenblatt" in col
    ]
    anzahl_aufgabenblaetter = len(aufgabenblatt_indices)
    print(f"Es wurden {anzahl_aufgabenblaetter} Aufgabenblätter gefunden.")

    # Überspringen der Maximalpunktzahl-Zeile
    next(reader)

    # Öffnen der Ausgabedatei
    with open(output_file, 'w', newline='') as output_csv:
        writer = csv.writer(output_csv, delimiter=';')

        # Kopfzeile schreiben
        writer.writerow(['Nachname', 'Vorname', 'Matrikelnummer', 'E-Mail'])

        # Iterieren durch die Zeilen der Eingabedatei
        for row in reader:
            # Punktzahlen der Aufgabenblätter holen und verarbeiten
            score_list = [
                row[i].replace(',', '.')
                for i in aufgabenblatt_indices
                if row[i].strip() != ""
            ]

            # Bestehende Aufgabenblätter zählen
            bestandene_blaetter = sum(1 for score in score_list if float(score) >= min_punkte_pro_blatt)

            # Bedingung prüfen
            if bestandene_blaetter >= min_blaetter_bestehen:
                matrikelnummer = row[3].strip()
                email = matrikelnummer_email_map.get(matrikelnummer, "Keine E-Mail gefunden")
                writer.writerow([row[0], row[1], matrikelnummer, email])

print(f"Die gefilterten Daten wurden in '{output_file}' gespeichert.")