import Papa from 'papaparse';

/** Alle CSV-Dateien des Projekts: Trennzeichen `;`, UTF-8, `\n`. */
export const CSV_DELIMITER = ';';

/** BOM (z. B. VIPS-Export) entfernen. */
export function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/** CSV-Text in Zeilen (String-Arrays) zerlegen. Leere Zeilen werden verworfen. */
export function parseCsvRows(text: string): string[][] {
  const result = Papa.parse<string[]>(stripBom(text).trim(), {
    delimiter: CSV_DELIMITER,
    skipEmptyLines: true,
  });
  if (result.errors.length > 0) {
    const first = result.errors[0];
    throw new Error(`CSV-Fehler in Zeile ${first.row}: ${first.message}`);
  }
  return result.data;
}

/** CSV mit Kopfzeile in Objekte zerlegen (Schlüssel = Spaltenname). */
export function parseCsvObjects(text: string): Record<string, string>[] {
  const rows = parseCsvRows(text);
  if (rows.length === 0) return [];
  const header = rows[0];
  return rows.slice(1).map((row) =>
    Object.fromEntries(header.map((name, i) => [name, (row[i] ?? '').trim()])),
  );
}

/** Zeilen als CSV-Text serialisieren (`;`, `\n`, Anführungszeichen nur bei Bedarf). */
export function toCsv(rows: (string | number | null | undefined)[][]): string {
  const text = Papa.unparse(rows.map((row) => row.map((cell) => cell ?? '')), {
    delimiter: CSV_DELIMITER,
    newline: '\n',
  });
  return text + '\n';
}
