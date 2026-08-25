import { lies, pfad } from './fixtures';
import {
  defaultZulassungsDateiname,
  neueZulassungen,
  parseNotenliste,
  parseStudipExport,
  zulassungenToCsv,
} from '../src';

const KRITERIEN = { minPunkteProBlatt: 30, minBlaetterBestehen: 3 };

describe('VIPS-Auswertung (Screen 1)', () => {
  const notenliste = parseNotenliste(lies(pfad.notenliste));
  const teilnehmer = parseStudipExport(lies(pfad.studipExport));

  it('liest die Notenliste mit BOM, Maximalpunkten und Umlauten', () => {
    expect(notenliste.aufgabenblaetter).toHaveLength(4);
    expect(notenliste.maximalpunkte).toEqual([75, 60, 75, 75]);
    expect(notenliste.eintraege).toHaveLength(10);
    expect(notenliste.eintraege.map((e) => e.nachname)).toContain('Schrödinger');
  });

  it('liest den Stud.IP-Export inkl. Lehrenden und Tutor:innen', () => {
    expect(teilnehmer).toHaveLength(14);
    expect(teilnehmer.filter((t) => t.status === 'autor')).toHaveLength(10);
    expect(teilnehmer[0]).toMatchObject({ status: 'dozent', nachname: 'Lovelace' });
  });

  it('ermittelt die 6 neuen Zulassungen mit E-Mail', () => {
    const zulassungen = neueZulassungen(notenliste, teilnehmer, KRITERIEN);
    expect(zulassungen.map((z) => z.nachname)).toEqual([
      'Archi', 'Darwin', 'Hodgkin', 'Kepler', 'Newton', 'Schrödinger',
    ]);
    expect(zulassungen[0].email).toBe('archimedes@test.de');
  });

  it('Pascal fällt durch (nur 1 Blatt über 30 Punkten)', () => {
    const zulassungen = neueZulassungen(notenliste, teilnehmer, KRITERIEN);
    expect(zulassungen.map((z) => z.nachname)).not.toContain('Pascal');
  });

  it('serialisiert das Ergebnis im Zulassungslisten-Format', () => {
    const csv = zulassungenToCsv(neueZulassungen(notenliste, teilnehmer, KRITERIEN));
    expect(csv.split('\n')[0]).toBe('Nachname;Vorname;Matrikelnummer;E-Mail');
    expect(csv).toContain('Archi;Archimedes;1000001;archimedes@test.de');
  });

  it('schlägt einen Default-Dateinamen vor', () => {
    expect(defaultZulassungsDateiname('Beispiel Veranstaltung', 2026))
      .toBe('Beispiel_Veranstaltung_2026_zulassungen.csv');
  });
});
