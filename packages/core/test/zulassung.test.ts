import { lies, liesZulassungsBestand, liesZulassungsQuellen, pfad } from './fixtures';
import {
  istZulassungsDatei,
  ladeZulassungsBestand,
  ladeZulassungsFunde,
  parseAnmeldungen,
  parseStudipExport,
  pruefeAnmeldungen,
  pruefeZulassungen,
  sucheImBestand,
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

  it('macht aus den Anmeldungen eine Teilnehmerliste – ohne Export aus Schritt 3', () => {
    const pruefung = pruefeAnmeldungen(parseAnmeldungen(lies(pfad.checkCsv)), bestand);
    expect(pruefung.alle).toHaveLength(8);
    expect(pruefung.zugelassen).toHaveLength(7);
    expect(pruefung.nichtZugelassen.map((a) => a.nachname)).toEqual(['Crick']);
    expect(pruefung.alleZugelassen).toBe(false);
    // Die E-Mail fehlt im HIS-Export und kommt aus dem Zulassungsbestand.
    expect(pruefung.zugelassen.every((a) => a.email !== '')).toBe(true);
    expect(pruefung.nichtZugelassen[0].email).toBe('');
  });

  describe('Suche im Bestand („hat diese Person eine Zulassung – und woher?“)', () => {
    const funde = ladeZulassungsFunde(liesZulassungsQuellen());

    it('nennt die Datei, aus der die Zulassung stammt', () => {
      const treffer = sucheImBestand(funde, 'Pascal');
      expect(treffer).toHaveLength(1);
      expect(treffer[0].zulassung.vorname).toBe('Blaise');
      expect(treffer[0].datei).toBe('swe++24_zulassungen.csv');
    });

    it('findet unabhängig von Groß-/Kleinschreibung, Reihenfolge und Umlauten', () => {
      // Umlaut getippt, Umlaut umschrieben, Namen vertauscht, Matrikelnummer.
      const varianten = ['schrödinger', 'SCHRÖDINGER', 'erwin schroedinger', '1000005'];
      for (const eingabe of varianten) {
        const treffer = sucheImBestand(funde, eingabe);
        expect(treffer.map((fund) => fund.datei)).toEqual(['pv2025_zulassungen.csv']);
      }
    });

    it('findet niemanden ohne Zulassung und nichts bei leerer Eingabe', () => {
      expect(sucheImBestand(funde, 'Crick')).toHaveLength(0);
      expect(sucheImBestand(funde, '   ')).toHaveLength(0);
    });
  });

  it('meldet „alle zugelassen“, wenn niemand ohne Zulassung angemeldet ist', () => {
    const anmeldungen = parseAnmeldungen(lies(pfad.checkCsv));
    const nurZugelassene = pruefeZulassungen(anmeldungen, bestand).zugelassen;
    const pruefung = pruefeAnmeldungen(nurZugelassene, bestand);
    expect(pruefung.alleZugelassen).toBe(true);
    expect(pruefung.alle).toHaveLength(7);
    expect(pruefung.nichtZugelassen).toHaveLength(0);
  });
});
