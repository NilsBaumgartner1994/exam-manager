import csv
import argparse

def filter_csv(input_file, output_file, status_filter="autor"):
    with open(input_file, "r", encoding="utf-8") as infile:
        reader = csv.DictReader(infile)
        
        # Define the output columns and delimiter
        output_columns = ["Nachname", "Vorname", "Matrikelnummer"]
        delimiter = ";"

        with open(output_file, "w", encoding="utf-8", newline="") as outfile:
            writer = csv.writer(outfile, delimiter=delimiter)
            # Write header row
            writer.writerow(output_columns)

            # Write filtered rows
            for row in reader:
                if row.get("Status", "").lower() == status_filter.lower():
                    writer.writerow([row.get("Nachname", ""), row.get("Vorname", ""), row.get("Matrikelnummer", "")])

def main():
    parser = argparse.ArgumentParser(description="Filter CSV by status and create a new CSV file.")
    parser.add_argument("--studip", type=str, required=True, help="Path to the studip CSV file.")
    parser.add_argument("--output", type=str, default="teilnehmerSimulatedFromStudIp.csv", help="Path to the output CSV file.")
    parser.add_argument("--status", default="autor", help="Status to filter by (default: 'autor').")

    args = parser.parse_args()

    filter_csv(args.studip, args.output, args.status)

if __name__ == "__main__":
    main()
