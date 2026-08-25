import { lies, liesZulassungsBestand, pfad } from './fixtures';
import {
  istZulassungsDatei,
  ladeZulassungsBestand,
  parseAnmeldungen,
  parseStudipExport,
  pruefeZulassungen,
  teilnehmerMitZulassung,
} from '../src';

describe('Zulassungsprüfung (Screen 2 + 3)', () => {
  const bestand = ladeZulassungsBestand(liesZulassungsBestand());

  it('erkennt nur *zulassungen*.csv als Bestandsdateien', () => {
    expect(istZulassungsDatei('swe++24_zulassungen.csv')).toBe(true);
    expect(istZulassungsDatei('pv2025_zulassungen.csv')).toBe(true);
    expect(istZulassungsDatei('check.csv')).toBe(false);
    expect(istZulassungsDatei('result.csv')).toBe(false);
  });

  it('findet die 9 Teilnehmenden mit Zulassung (neu oder Vorjahr)', () => {
    const teilnehmer = parseStudipExport(lies(pfad.studipExport));
    const mitZulassung = teilnehmerMitZulassung(teilnehmer, bestand);
    expect(mitZulassung).toHaveLength(9);
    // Crick ist angemeldet, hat aber nie eine Zulassung erworben
    expect(mitZulassung.map((z) => z.nachname)).not.toContain('Crick');
    // Lehrende/Tutor:innen (ohne Matrikelnummer) tauchen nie auf
    expect(mitZulassung.map((z) => z.nachname)).not.toContain('Lovelace');
  });

  it('teilt die Klausur-Anmeldungen in zugelassen (7) und nicht zugelassen (1)', () => {
    const anmeldungen = parseAnmeldungen(lies(pfad.checkCsv));
    const { zugelassen, nichtZugelassen } = pruefeZulassungen(anmeldungen, bestand);
    expect(zugelassen).toHaveLength(7);
    expect(nichtZugelassen.map((a) => a.nachname)).toEqual(['Crick']);
  });
});
