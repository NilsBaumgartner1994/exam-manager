import csv
import argparse
from collections import defaultdict

def normalize_name(name):
    """Wandelt Umlaute in Ersatzdarstellungen um (nur für Sortierung)."""
    return name.replace('Ä', 'AE').replace('Ö', 'OE').replace('Ü', 'UE').replace('ä', 'ae').replace('ö', 'oe').replace('ü', 'ue').replace('ß', 'ss')

def load_rooms(rooms_path):
    rooms = []
    with open(rooms_path, 'r') as f:
        reader = csv.DictReader(f, delimiter=';')
        for row in reader:
            rooms.append({
                'Raum': row['Raum'],
                'Plätze': int(row['Plätze']),
                'ReservierteZeit': row['ReservierteZeit'],
                'Belegt': 0
            })
    return rooms

def distribute_students(teilnehmer, rooms, mode="balanced"):
    output = []
    total_capacity = sum(room['Plätze'] for room in rooms)

    if len(teilnehmer) > total_capacity:
        print("Warnung: Nicht genug Plätze für alle Teilnehmer vorhanden!")

    room_index = 0  # für sequentielles Füllen

    for nachname, vorname, matrikelnummer, email in teilnehmer:

        if mode == "balanced":
            # Raum mit geringster relativer Auslastung
            rooms.sort(key=lambda r: r['Belegt'] / r['Plätze'])
            target_rooms = rooms

        elif mode == "sequential":
            # Aktueller Raum, dann weiter
            while room_index < len(rooms) and rooms[room_index]['Belegt'] >= rooms[room_index]['Plätze']:
                room_index += 1
            if room_index >= len(rooms):
                break
            target_rooms = [rooms[room_index]]

        else:
            raise ValueError("Unbekannter Verteilmodus")

        for room in target_rooms:
            if room['Belegt'] < room['Plätze']:
                room['Belegt'] += 1
                output.append({
                    'Matrikelnummer': matrikelnummer,
                    'Email': email,
                    'Nachname': nachname,
                    'Vorname': vorname,
                    'Raum': room['Raum'],
                    'ReservierteZeit': room['ReservierteZeit'],
                    'Sitzplatznummer': None,
                    'Zeit_und_Raum': None,
                    'Anwesend': None,
                    'Anfang_Nachname': None
                })
                break

    return output


def assign_seat_numbers(output):
    # Füge Zeit_und_Raum hinzu, falls noch nicht geschehen
    for row in output:
        row['Zeit_und_Raum'] = f"{row['ReservierteZeit']} - {row['Raum']}"

    # Sortiere nach Raum_und_Zeit und Nachnamen (Umlaute normalisiert für Sortierung)
    output.sort(key=lambda x: (x['Zeit_und_Raum'], normalize_name(x['Nachname'])))

    # Vergibt Sitzplatznummern, beginnend bei 1000
    seat_counter = 1001
    for row in output:
        row['Sitzplatznummer'] = seat_counter
        seat_counter += 1
    return output

def assign_initials(output):
    # Berechne Anfang_Nachname basierend auf Nachname + "_" + Vorname
    full_names = [f"{row['Nachname']}_{row['Vorname']}" for row in output]
    prefix_map = {}

    for full_name in full_names:
        normalized_full_name = normalize_name(full_name)
        prefix = ""
        for i in range(1, len(normalized_full_name) + 1):
            prefix = normalized_full_name[:i]
            if not any(normalize_name(other).startswith(prefix) and other != full_name for other in full_names):
                break
        prefix_map[full_name] = prefix

    for row in output:
        full_name = f"{row['Nachname']}_{row['Vorname']}"
        row['Anfang_Nachname'] = prefix_map[full_name]

    return output

def write_output(output, output_path):
    # Schreibe die Ausgabe in der gewünschten Spaltenreihenfolge
    with open(output_path, 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=['Anfang_Nachname', 'Sitzplatznummer','Raum', 'ReservierteZeit','Matrikelnummer', 'Anwesend', 'Nachname', 'Vorname', 'Zeit_und_Raum', 'Email'], delimiter=';')
        writer.writeheader()
        for row in output:
            writer.writerow(row)

def merge_csvs(teilnehmer_path, studip_path, rooms_path, output_path, mode):
    # Lese die Teilnehmer-Datei
    with open(teilnehmer_path, 'r') as f:
        reader = csv.reader(f, delimiter=';')
        teilnehmer = list(reader)

    # Ignoriere die Kopfzeile, falls vorhanden
    if teilnehmer[0] == ["Nachname", "Vorname", "Matrikelnummer"]:
        teilnehmer = teilnehmer[1:]

    # Lese die Studip-Datei und erstelle ein Dictionary basierend auf der Matrikelnummer
    studip_dict = {}
    with open(studip_path, 'r') as f:
        reader = csv.DictReader(f, delimiter=';')
        for row in reader:
            matrikelnummer = row['Matrikelnummer']
            email = row['E-Mail']
            studip_dict[matrikelnummer] = email

    # Aktualisiere die Teilnehmer mit Emails
    for i in range(len(teilnehmer)):
        matrikelnummer = teilnehmer[i][2]
        email = studip_dict.get(matrikelnummer, "")
        teilnehmer[i].append(email)

    # Lese die Räume
    rooms = load_rooms(rooms_path)

    # Verteile die Studierenden auf Räume
    output = distribute_students(teilnehmer, rooms, mode)


    # Vergibt Sitzplatznummern basierend auf Raum_und_Zeit und Nachname
    output = assign_seat_numbers(output)

    # Berechne Anfang_Nachname basierend auf Nachname + Vorname
    output = assign_initials(output)

    # Schreibe die Ausgabe-Datei
    write_output(output, output_path)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Merge two CSV files and distribute students across rooms.")
    parser.add_argument("--teilnehmer", type=str, required=True)
    parser.add_argument("--studip", type=str, required=True)
    parser.add_argument("--raeume", type=str, required=True)
    parser.add_argument("--output", type=str, default="studierendeZuRaumUndZeitZuordnung.csv")
    args = parser.parse_args()

    print("Wie sollen die Räume gefüllt werden?")
    print("1 = Räume nacheinander vollständig füllen")
    print("2 = Gleichmäßig nach geringster Auslastung verteilen (Standard)")

    choice = input("Auswahl (1/2): ").strip()

    if choice == "1":
        mode = "sequential"
    else:
        mode = "balanced"

    merge_csvs(args.teilnehmer, args.studip, args.raeume, args.output, mode)

