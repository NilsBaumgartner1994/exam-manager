/**
 * Die Tests laufen gegen den anonymisierten Beispiel-Datensatz des Repos
 * (siehe README, "Beispieldaten") – erwartete Zahlen: 6 neue Zulassungen,
 * 9 Teilnehmende mit Zulassung, 7 zugelassene Angemeldete, 1 ohne Zulassung.
 */
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..', '..', '..');

export const pfad = {
  zulassungenOrdner: join(ROOT, 'Zulassungen'),
  checkXlsx: join(ROOT, 'Zulassungen', 'check.xlsx'),
  checkCsv: join(ROOT, 'Zulassungen', 'check.csv'),
  notenliste: join(ROOT, 'Zuslassungliste_Erstellen', '1_check_bestandene_vips', 'Notenliste.csv'),
  studipExport: join(
    ROOT, 'Zuslassungliste_Erstellen', '1_check_bestandene_vips',
    'Teilnehmendenexport_Beispielveranstaltung.csv',
  ),
  raeume: join(
    ROOT, 'Zuslassungliste_Erstellen', '4_MailRaumZuordnung', '2_raum_zuteilung_erstellen', 'raeume.csv',
  ),
  /** Ordner mit den Rastern – je Raum eine Datei (`01_E01.csv`, …). */
  raumschemaOrdner: join(
    ROOT, 'Zuslassungliste_Erstellen', '4_MailRaumZuordnung', '2_raum_zuteilung_erstellen',
    'raumschema',
  ),
  sitzplan: join(
    ROOT, 'Zuslassungliste_Erstellen', '4_MailRaumZuordnung', '2_raum_zuteilung_erstellen',
    'studierendeZuRaumUndZeitZuordnung.csv',
  ),
};

export function lies(datei: string): string {
  return readFileSync(datei, 'utf-8');
}

/** Alle Raster des Beispieldatensatzes – je Raum eine Datei. */
export function liesRaumschemata(): string[] {
  return readdirSync(pfad.raumschemaOrdner)
    .filter((name) => name.toLowerCase().endsWith('.csv'))
    .sort()
    .map((name) => readFileSync(join(pfad.raumschemaOrdner, name), 'utf-8'));
}

/** Alle Zulassungslisten des Bestands (wie das Skript: nur *zulassungen*.csv). */
export function liesZulassungsBestand(): string[] {
  return liesZulassungsQuellen().map((quelle) => quelle.text);
}

/** Derselbe Bestand, aber mit den Dateinamen – für die Suche in Schritt 2. */
export function liesZulassungsQuellen(): { datei: string; text: string }[] {
  return readdirSync(pfad.zulassungenOrdner)
    .filter((name) => /zulassungen.*\.csv$/i.test(name))
    .sort()
    .map((name) => ({
      datei: name,
      text: readFileSync(join(pfad.zulassungenOrdner, name), 'utf-8'),
    }));
}
