/**
 * Portierung von `1_check_bestandene_vips/checkPermissionVips.py`:
 * Wer hat über die VIPS-Punkte die Klausurzulassung neu erworben?
 */
import { parseCsvRows, toCsv } from './csv';
import { emailMap } from './studip';
import { Notenliste, NotenlistenEintrag, StudipTeilnehmer, Zulassung } from './types';

/** VIPS-Notenliste einlesen (Zeile 1 = Kopf, Zeile 2 = Maximalpunktzahl). */
export function parseNotenliste(csvText: string): Notenliste {
  const rows = parseCsvRows(csvText);
  if (rows.length < 2) {
    throw new Error('Notenliste ist leer oder hat keine Maximalpunktzahl-Zeile.');
  }
  const header = rows[0];
  const blattIndices = header
    .map((name, i) => ({ name, i }))
    .filter(({ name }) => name.includes('Aufgabenblatt'));
  if (blattIndices.length === 0) {
    throw new Error('Keine Spalte mit "Aufgabenblatt" in der Notenliste gefunden.');
  }

  const maxRow = rows[1];
  const maximalpunkte = blattIndices.map(({ i }) => parseNumber(maxRow[i]) ?? 0);

  const eintraege: NotenlistenEintrag[] = rows.slice(2).map((row) => ({
    nachname: (row[0] ?? '').trim(),
    vorname: (row[1] ?? '').trim(),
    kennung: (row[2] ?? '').trim(),
    matrikelnummer: (row[3] ?? '').trim(),
    punkte: blattIndices.map(({ i }) => parseNumber(row[i])),
  }));

  return {
    aufgabenblaetter: blattIndices.map(({ name }) => name),
    maximalpunkte,
    eintraege,
  };
}

/** "38,5" oder "38.5" → Zahl; leere Zelle → null. */
function parseNumber(cell: string | undefined): number | null {
  const raw = (cell ?? '').trim();
  if (raw === '') return null;
  const value = Number(raw.replace(',', '.'));
  if (Number.isNaN(value)) throw new Error(`Ungültige Punktzahl: "${raw}"`);
  return value;
}

export interface VipsKriterien {
  /** Minimale Punktzahl, mit der ein Aufgabenblatt als bestanden gilt. */
  minPunkteProBlatt: number;
  /** Anzahl Aufgabenblätter, die mindestens bestanden sein müssen. */
  minBlaetterBestehen: number;
}

/** Anzahl bestandener Aufgabenblätter eines Eintrags. */
export function bestandeneBlaetter(eintrag: NotenlistenEintrag, kriterien: VipsKriterien): number {
  return eintrag.punkte.filter((p) => p !== null && p >= kriterien.minPunkteProBlatt).length;
}

/**
 * Alle Studierenden, die die VIPS-Kriterien erfüllen, angereichert mit der
 * E-Mail aus dem Stud.IP-Export (Reihenfolge wie in der Notenliste).
 */
export function neueZulassungen(
  notenliste: Notenliste,
  teilnehmer: StudipTeilnehmer[],
  kriterien: VipsKriterien,
): Zulassung[] {
  const mails = emailMap(teilnehmer);
  return notenliste.eintraege
    .filter((e) => bestandeneBlaetter(e, kriterien) >= kriterien.minBlaetterBestehen)
    .map((e) => ({
      nachname: e.nachname,
      vorname: e.vorname,
      matrikelnummer: e.matrikelnummer,
      email: mails.get(e.matrikelnummer) ?? 'Keine E-Mail gefunden',
    }));
}

/** Zulassungsliste als CSV (`Nachname;Vorname;Matrikelnummer;E-Mail`). */
export function zulassungenToCsv(zulassungen: Zulassung[]): string {
  return toCsv([
    ['Nachname', 'Vorname', 'Matrikelnummer', 'E-Mail'],
    ...zulassungen.map((z) => [z.nachname, z.vorname, z.matrikelnummer, z.email]),
  ]);
}

/** Default-Dateiname für den Download: `<veranstaltung>_<jahr>_zulassungen.csv` */
export function defaultZulassungsDateiname(veranstaltung: string, jahr: number): string {
  const slug = veranstaltung.trim().replace(/\s+/g, '_') || 'veranstaltung';
  return `${slug}_${jahr}_zulassungen.csv`;
}
