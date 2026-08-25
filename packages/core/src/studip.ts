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
