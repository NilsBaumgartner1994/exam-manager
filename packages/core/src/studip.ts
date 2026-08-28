import { parseCsvObjects } from './csv';
import { StudipTeilnehmer } from './types';

/** Teilnehmendenexport aus Stud.IP einlesen. */
export function parseStudipExport(csvText: string): StudipTeilnehmer[] {
  return parseCsvObjects(csvText).map((row) => ({
    status: row['Status'] ?? '',
    vorname: row['Vorname'] ?? '',
    nachname: row['Nachname'] ?? '',
    benutzername: row['Benutzername'] ?? '',
    email: row['E-Mail'] ?? '',
    matrikelnummer: row['Matrikelnummer'] ?? '',
  }));
}

/** Nur Studierende (Status `autor`) – Lehrende und Tutor:innen herausfiltern. */
export function nurStudierende(teilnehmer: StudipTeilnehmer[]): StudipTeilnehmer[] {
  return teilnehmer.filter((t) => t.status.toLowerCase() === 'autor');
}

/** Matrikelnummer → E-Mail (wie in checkPermissionVips.py). */
export function emailMap(teilnehmer: StudipTeilnehmer[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const t of teilnehmer) {
    if (t.matrikelnummer) map.set(t.matrikelnummer, t.email);
  }
  return map;
}

/**
 * Präfixe, die Stud.IP dem Kursnamen im Export voranstellt. Der Name der
 * Veranstaltung steckt im Dateinamen – im Export selbst steht er nirgends.
 */
const EXPORT_PRAEFIXE = ['teilnehmendenexport', 'teilnehmerexport'];

/**
 * Kursname aus dem Dateinamen des Stud.IP-Exports:
 * `Teilnehmendenexport_Software_Engineering.csv` → `Software Engineering`.
 *
 * Stud.IP setzt den Namen der Veranstaltung in den Dateinamen und ersetzt
 * Leerzeichen durch Unterstriche; in der Datei selbst steht er nicht. Damit
 * ist der Dateiname die einzige Quelle, aus der die App weiß, um welchen Kurs
 * es geht – deshalb wird er hier zurückübersetzt statt abgetippt.
 *
 * Passt nichts (kein Präfix, leerer Rest), ist das Ergebnis leer: Lieber
 * keinen Kurs anzeigen als einen geratenen.
 */
export function kursAusDateiname(pfad: string): string {
  const name = (pfad.split('/').pop() ?? pfad).replace(/\.[^.]+$/, '');
  const klein = name.toLowerCase();
  const praefix = EXPORT_PRAEFIXE.find((kandidat) => klein.startsWith(kandidat));
  const rest = praefix === undefined ? name : name.slice(praefix.length);
  return rest
    .replace(/^[_\-\s]+/, '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
