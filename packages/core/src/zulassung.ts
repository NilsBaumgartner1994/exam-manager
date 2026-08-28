/**
 * Portierung von `Zulassungen/checkPermissions.py` und
 * `2_mail_versenden_.../1_erstelle_liste_mit_zulassung_aus_teilnehmer_liste.py`:
 * Abgleich von Personen gegen den Zulassungsbestand aller Jahre.
 */
import { parseCsvRows } from './csv';
import { normalizeName } from './namen';
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

/** Eine Zulassungsliste zusammen mit der Datei, aus der sie stammt. */
export interface ZulassungsQuelle {
  /** Dateiname bzw. Pfad, so wie die Liste im Ordner liegt. */
  datei: string;
  /** Inhalt der CSV. */
  text: string;
}

/**
 * Fundstelle einer Person im Bestand: ihr Eintrag und die Liste, in der er
 * steht.
 *
 * Das Datum der Zulassung steht nirgends in den Daten – gespeichert wird nur,
 * wer zugelassen ist. Die Datei ist die einzige Zeitangabe, die es gibt: Sie
 * trägt das Jahr im Namen (`pv2025_zulassungen.csv`). Mehrere Funde zu einer
 * Person heißen, dass sie die Zulassung in mehreren Jahren erworben hat.
 */
export interface ZulassungsFund {
  zulassung: Zulassung;
  /** Datei, aus der der Eintrag stammt. */
  datei: string;
}

/**
 * Bestand aus benannten Listen lesen und dabei mitführen, aus welcher Datei
 * jeder Eintrag stammt (siehe `ZulassungsFund`).
 */
export function ladeZulassungsFunde(quellen: ZulassungsQuelle[]): ZulassungsFund[] {
  return quellen.flatMap((quelle) =>
    parseZulassungsliste(quelle.text).map((zulassung) => ({ zulassung, datei: quelle.datei })),
  );
}

/**
 * Personen im Bestand suchen – für die Frage „hat diese Person eine Zulassung,
 * und wenn ja, aus welchem Jahr?“.
 *
 * Gesucht wird bewusst großzügiger als beim Abgleich der Listen
 * (`pruefeZulassungen`, exakter Vergleich): Wer von Hand tippt, kennt selten
 * die Schreibweise des Exports. Jedes Wort der Eingabe muss irgendwo in
 * Vorname, Nachname oder Matrikelnummer vorkommen – Groß-/Kleinschreibung,
 * Reihenfolge und Umlaute (`Schrödinger` = `Schroedinger`) sind egal.
 */
export function sucheImBestand(funde: ZulassungsFund[], suchbegriff: string): ZulassungsFund[] {
  const worte = suchWorte(suchbegriff);
  if (worte.length === 0) return [];
  return funde.filter((fund) => {
    const heuhaufen = suchtext(
      `${fund.zulassung.vorname} ${fund.zulassung.nachname} ${fund.zulassung.matrikelnummer}`,
    );
    return worte.every((wort) => heuhaufen.includes(wort));
  });
}

function suchtext(text: string): string {
  return normalizeName(text).toLowerCase();
}

function suchWorte(suchbegriff: string): string[] {
  return suchtext(suchbegriff)
    .split(/\s+/)
    .filter((wort) => wort !== '');
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

/**
 * Ergebnis der Prüfung der Klausuranmeldungen gegen den Zulassungsbestand –
 * fertig als Teilnehmerliste für Schritt 4.
 *
 * Schritt 4 braucht den Export aus Schritt 3 damit nicht zwingend: Liegt im
 * Projektordner keine geprüfte Teilnehmerliste, kann er die Anmeldungen aus
 * `0_Input_Klausuranmeldungen/` selbst prüfen. Sind alle zugelassen, gibt es
 * nichts zu entscheiden; sonst fragt der Screen nach.
 */
export interface AnmeldungsPruefung {
  /** Alle Angemeldeten in der Reihenfolge des HIS-Exports. */
  alle: Zulassung[];
  /** Angemeldet **und** im Zulassungsbestand gefunden. */
  zugelassen: Zulassung[];
  /** Angemeldet, aber ohne Zulassung. */
  nichtZugelassen: Zulassung[];
  /** Niemand ohne Zulassung – die Anmeldungen sind ohne Rückfrage brauchbar. */
  alleZugelassen: boolean;
}

/**
 * Anmeldungen des Prüfungsamts gegen den Bestand prüfen und als
 * Teilnehmerliste aufbereiten.
 *
 * Abweichung von `checkPermissions.py` (bewusst): Die E-Mail-Adresse kommt aus
 * dem Zulassungsbestand dazu, wenn die Person dort steht – der HIS-Export hat
 * keine. Das Skript kopiert nur die drei Spalten der Anmeldung; hier ist die
 * Adresse für die Sitzplatz-PDFs in Schritt 4 nützlich und kostet nichts.
 */
export function pruefeAnmeldungen(
  anmeldungen: Anmeldung[],
  bestand: Zulassung[],
): AnmeldungsPruefung {
  const emails = new Map<string, string>();
  for (const person of bestand) {
    const vorhanden = emails.get(key(person));
    if (vorhanden === undefined || vorhanden === '') emails.set(key(person), person.email);
  }
  const alle: Zulassung[] = anmeldungen.map((anmeldung) => ({
    ...anmeldung,
    email: emails.get(key(anmeldung)) ?? '',
  }));
  const { zugelassen, nichtZugelassen } = pruefeZulassungen(alle, bestand);
  return { alle, zugelassen, nichtZugelassen, alleZugelassen: nichtZugelassen.length === 0 };
}
