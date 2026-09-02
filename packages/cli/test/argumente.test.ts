import {
  FehlendeAngabe,
  gesetzt,
  hilfeText,
  lieseArgumente,
  pflichtText,
  text,
  uebersicht,
  zahl,
} from '../src/argumente';
import { BEFEHLE } from '../src/befehle';

describe('Argumente lesen', () => {
  it('trennt Pfade von Schaltern', () => {
    const args = lieseArgumente(['Notenliste.csv', 'export.csv', '--min_points', '30']);
    expect(args.positionen).toEqual(['Notenliste.csv', 'export.csv']);
    expect(text(args, 'min_points')).toBe('30');
  });

  it('nimmt --name=wert genauso wie --name wert', () => {
    expect(text(lieseArgumente(['--out=liste.csv']), 'out')).toBe('liste.csv');
    expect(text(lieseArgumente(['--out', 'liste.csv']), 'out')).toBe('liste.csv');
  });

  it('behandelt Unterstrich und Bindestrich als dasselbe Zeichen', () => {
    // Wer tippt, soll nicht raten müssen, welche Schreibweise gemeint ist.
    expect(zahl(lieseArgumente(['--min-points', '25']), 'min_points')).toBe(25);
    expect(zahl(lieseArgumente(['--MIN_POINTS', '25']), 'min-points')).toBe(25);
  });

  it('erkennt einen Schalter ohne Wert', () => {
    const args = lieseArgumente(['--trotzdem']);
    expect(gesetzt(args, 'trotzdem')).toBe(true);
    expect(gesetzt(args, 'projekt')).toBe(false);
  });

  it('nimmt die Vorbelegung, wenn eine Zahl fehlt', () => {
    expect(zahl(lieseArgumente([]), 'min_points', 30)).toBe(30);
  });

  it('meldet eine fehlende oder falsche Angabe als Rückfrage', () => {
    // `FehlendeAngabe` ist kein Absturz: Oben wird daraus die Hilfe des Befehls.
    expect(() => zahl(lieseArgumente([]), 'min_points')).toThrow(FehlendeAngabe);
    expect(() => zahl(lieseArgumente(['--min_points', 'viel']), 'min_points')).toThrow(
      FehlendeAngabe,
    );
    expect(() => pflichtText(lieseArgumente([]), 'projekt')).toThrow(/--projekt/);
    expect(() => text(lieseArgumente(['--out']), 'out')).toThrow(/--out braucht einen Wert/);
  });
});

describe('Hilfe', () => {
  it('nennt zu jedem Befehl Aufruf, Schalter und Beispiele', () => {
    for (const befehl of BEFEHLE) {
      const hilfe = hilfeText(befehl.beschreibung);
      expect(hilfe).toContain(`yarn ${befehl.beschreibung.name}`);
      for (const schalter of befehl.beschreibung.schalter) {
        expect(hilfe).toContain(`--${schalter.name}`);
      }
      expect(befehl.beschreibung.beispiele.length).toBeGreaterThan(0);
      for (const beispiel of befehl.beschreibung.beispiele) {
        expect(beispiel.startsWith(`yarn ${befehl.beschreibung.name} `)).toBe(true);
      }
    }
  });

  it('führt in der Übersicht jeden Befehl auf', () => {
    const text = uebersicht(BEFEHLE.map((befehl) => befehl.beschreibung));
    for (const befehl of BEFEHLE) expect(text).toContain(befehl.beschreibung.name);
  });

  it('hat für jeden Screen genau einen Befehl', () => {
    // Die Kommandozeile bildet die fünf Schritte der App ab – kommt ein
    // Screen dazu, kommt hier ein Befehl dazu.
    expect(BEFEHLE.map((befehl) => befehl.beschreibung.name)).toEqual([
      '1_vips',
      '2_zulassung',
      '3_teilnehmende',
      '4_raumzuteilung',
      '5_raeume',
    ]);
  });
});
