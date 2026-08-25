/**
 * Portierung von `Zulassungen/checkPermissions.py` und
 * `2_mail_versenden_.../1_erstelle_liste_mit_zulassung_aus_teilnehmer_liste.py`:
 * Abgleich von Personen gegen den Zulassungsbestand aller Jahre.
 */
import { parseCsvRows } from './csv';
import { Anmeldung, StudipTeilnehmer, Zulassung } from './types';

/** Eine Zulassungs-CSV (`Nachname;Vorname;Matrikelnummer[;E-Mail]`, Kopfzeile optional). */
export function parseZulassungsliste(csvText: string): Zulassung[] {
  const rows = parseCsvRows(csvText);
  return rows
    .filter((row) => (row[0] ?? '').trim().toLowerCase() !== 'nachname')
    .map((row) => ({
      nachname: (row[0] ?? '').trim(),
      vorname: (row[1] ?? '').trim(),
      matrikelnummer: (row[2] ?? '').trim(),
      email: (row[3] ?? '').trim(),
    }));
}

/** Suchschlüssel wie in checkPermissions.py: `Nachname;Vorname;Matrikelnummer`. */
function key(p: { nachname: string; vorname: string; matrikelnummer: string }): string {
  return `${p.nachname};${p.vorname};${p.matrikelnummer}`;
}

export interface ZulassungsPruefung<T> {
  /** Personen, die im Zulassungsbestand gefunden wurden. */
  zugelassen: T[];
  /** Personen ohne Eintrag im Zulassungsbestand. */
  nichtZugelassen: T[];
}

/**
 * Personen gegen den Bestand (alle Zulassungslisten zusammen) prüfen.
 * Übereinstimmung wie im Python-Original: exakter Vergleich von
 * Nachname, Vorname und Matrikelnummer.
 */
export function pruefeZulassungen<T extends { nachname: string; vorname: string; matrikelnummer: string }>(
  personen: T[],
  bestand: Zulassung[],
): ZulassungsPruefung<T> {
  const keys = new Set(bestand.map(key));
  const zugelassen: T[] = [];
  const nichtZugelassen: T[] = [];
  for (const person of personen) {
    (keys.has(key(person)) ? zugelassen : nichtZugelassen).push(person);
  }
  return { zugelassen, nichtZugelassen };
}

/**
 * Alle Teilnehmenden einer Veranstaltung mit Zulassung (neu oder aus früheren
 * Jahren). Lehrende/Tutor:innen ohne Matrikelnummer finden nie einen Treffer.
 */
export function teilnehmerMitZulassung(
  teilnehmer: StudipTeilnehmer[],
  bestand: Zulassung[],
): Zulassung[] {
  const { zugelassen } = pruefeZulassungen(
    teilnehmer.filter((t) => t.matrikelnummer !== ''),
    bestand,
  );
  return zugelassen.map((t) => ({
    nachname: t.nachname,
    vorname: t.vorname,
    matrikelnummer: t.matrikelnummer,
    email: t.email,
  }));
}

/** Mehrere Zulassungslisten (Ordnerinhalt) zu einem Bestand zusammenführen. */
export function ladeZulassungsBestand(csvTexte: string[]): Zulassung[] {
  return csvTexte.flatMap(parseZulassungsliste);
}

/**
 * Nur Dateien mit `zulassungen` im Namen zählen als Bestand –
 * check.csv/result.csv im selben Ordner werden ignoriert (wie im Python-Skript).
 */
export function istZulassungsDatei(dateiname: string): boolean {
  return /zulassungen.*\.csv$/i.test(dateiname);
}

/** Anmeldungs-CSV (`Nachname;Vorname;Matrikelnummer`, ohne Kopfzeile) einlesen. */
export function parseAnmeldungen(csvText: string): Anmeldung[] {
  return parseCsvRows(csvText).map((row) => ({
    nachname: (row[0] ?? '').trim(),
    vorname: (row[1] ?? '').trim(),
    matrikelnummer: (row[2] ?? '').trim(),
  }));
}
