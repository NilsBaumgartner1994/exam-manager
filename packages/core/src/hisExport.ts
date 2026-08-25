/**
 * Portierung von `Zulassungen/1_transform_exel_to_csv.py`:
 * HIS-Export des Prüfungsamts (check.xlsx) → Anmeldungen.
 *
 * Das Einlesen der .xlsx-Datei selbst passiert außerhalb (Browser:
 * `read-excel-file`, Node: `read-excel-file/node`); hier wird nur die
 * Zellenmatrix interpretiert – dadurch bleibt das Modul plattformneutral.
 */
import { toCsv } from './csv';
import { Anmeldung } from './types';

/** Zellwert, wie ihn Excel-Reader liefern (read-excel-file, exceljs, …). */
type Cell = unknown;

/**
 * Zellenmatrix des HIS-Sheets in Anmeldungen wandeln.
 * Erwartet eine Kopfzeile mit "Matrikelnummer", "Nachname", "Vorname";
 * Zeilen ab "endHISsheet" werden ignoriert.
 */
export function parseHisRows(rows: Cell[][]): Anmeldung[] {
  const headerIndex = rows.findIndex((row) =>
    row.some((cell) => String(cell ?? '').trim() === 'Matrikelnummer'),
  );
  if (headerIndex === -1) {
    throw new Error('Keine Kopfzeile mit "Matrikelnummer" gefunden – ist das ein HIS-Export?');
  }
  const header = rows[headerIndex].map((cell) => String(cell ?? '').trim());
  const col = (name: string) => {
    const i = header.indexOf(name);
    if (i === -1) throw new Error(`Spalte "${name}" fehlt im HIS-Export.`);
    return i;
  };
  const matrikel = col('Matrikelnummer');
  const nachname = col('Nachname');
  const vorname = col('Vorname');

  const anmeldungen: Anmeldung[] = [];
  for (const row of rows.slice(headerIndex + 1)) {
    const first = String(row[0] ?? '').trim();
    if (first === 'endHISsheet') break;
    if (first === '') continue;
    anmeldungen.push({
      matrikelnummer: String(row[matrikel] ?? '').trim(),
      nachname: String(row[nachname] ?? '').trim(),
      vorname: String(row[vorname] ?? '').trim(),
    });
  }
  return anmeldungen;
}

/** Anmeldungen als `check.csv` (`Nachname;Vorname;Matrikelnummer`, ohne Kopfzeile). */
export function anmeldungenToCsv(anmeldungen: Anmeldung[]): string {
  return toCsv(anmeldungen.map((a) => [a.nachname, a.vorname, a.matrikelnummer]));
}
