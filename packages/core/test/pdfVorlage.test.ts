import {
  fuelleVorlage,
  inlineStuecke,
  parseMarkdown,
  sitzplatzWerte,
  VORLAGE_SITZPLATZ,
  VORLAGE_ZULASSUNG,
  zulassungsWerte,
} from '../src';

const SITZPLATZ = {
  anfangNachname: 'S', sitzplatznummer: 1021, raum: '94/E03', raumSchluessel: '94/E03',
  reservierteZeit: '03.03.2026 Gruppe 1', matrikelnummer: '1000005', anwesend: '',
  nachname: 'Schrödinger', vorname: 'Erwin', zeitUndRaum: '', email: 'erwin@test.de',
};

describe('Platzhalter in der Vorlage', () => {
  it('setzt die Werte einer Person ein', () => {
    const text = fuelleVorlage('Liebe/r <Vorname> <Nachname> (<Matrikelnummer>)', {
      Vorname: 'Erwin', Nachname: 'Schrödinger', Matrikelnummer: '1000005',
    });
    expect(text).toBe('Liebe/r Erwin Schrödinger (1000005)');
  });

  it('lässt einen unbekannten Platzhalter stehen', () => {
    // Ein Tippfehler soll im PDF auffallen und nicht ein Feld still leeren.
    expect(fuelleVorlage('Hallo <Vornmae>', { Vorname: 'Erwin' })).toBe('Hallo <Vornmae>');
  });

  it('füllt beide Anfangsvorlagen vollständig', () => {
    const zulassung = fuelleVorlage(VORLAGE_ZULASSUNG, zulassungsWerte({
      nachname: 'Schrödinger', vorname: 'Erwin', matrikelnummer: '1000005', email: 'erwin@test.de',
    }));
    const sitzplatz = fuelleVorlage(VORLAGE_SITZPLATZ, sitzplatzWerte(SITZPLATZ));
    for (const text of [zulassung, sitzplatz]) expect(text).not.toMatch(/<[^<>\n]+>/);
    expect(sitzplatz).toContain('SITZPLATZNUMMER: 1021');
    expect(sitzplatz).toContain('94/E03');
    expect(zulassung).toContain('Erwin Schrödinger 1000005 erwin@test.de');
  });
});

describe('Markdown der Vorlage', () => {
  it('macht aus jeder Zeile einen eigenen Block', () => {
    // Anders als in Markdown üblich: Ein Anschreiben wird zeilenweise
    // gesetzt, nicht zu einem Fließtextabsatz zusammengezogen.
    const bloecke = parseMarkdown('Erste Zeile\nZweite Zeile');
    expect(bloecke).toHaveLength(2);
    expect(bloecke[1].stuecke[0].text).toBe('Zweite Zeile');
  });

  it('merkt sich Leerzeilen als Abstand', () => {
    const bloecke = parseMarkdown('Oben\n\n\nUnten');
    expect(bloecke[1].leerzeilenDavor).toBe(2);
    // Führende Leerzeilen zählen nicht – sonst rutschte das Blatt nach unten.
    expect(parseMarkdown('\n\nOben')[0].leerzeilenDavor).toBe(0);
  });

  it('erkennt Überschriften, Punkte, Nummern und Trennlinien', () => {
    const bloecke = parseMarkdown('# Groß\n### Klein\n- Punkt\n2. Zweitens\n---\nText');
    expect(bloecke.map((block) => block.art)).toEqual([
      'ueberschrift', 'ueberschrift', 'punkt', 'punkt', 'linie', 'absatz',
    ]);
    expect(bloecke[0].faktor).toBeGreaterThan(bloecke[1].faktor);
    expect(bloecke[0].fett).toBe(true);
    expect(bloecke[2].marke).toBe('-');
    expect(bloecke[3].marke).toBe('2.');
    expect(bloecke[3].stuecke[0].text).toBe('Zweitens');
  });

  it('zerlegt fett, kursiv und beides', () => {
    expect(inlineStuecke('Mit **fett**, *kursiv* und ***beidem***.')).toEqual([
      { text: 'Mit ', fett: false, kursiv: false },
      { text: 'fett', fett: true, kursiv: false },
      { text: ', ', fett: false, kursiv: false },
      { text: 'kursiv', fett: false, kursiv: true },
      { text: ' und ', fett: false, kursiv: false },
      { text: 'beidem', fett: true, kursiv: true },
      { text: '.', fett: false, kursiv: false },
    ]);
  });

  it('lässt Unterstriche in Ruhe', () => {
    // `94_E01 bis 94_E03` darf nicht mitten im Satz kursiv werden.
    expect(inlineStuecke('Raum 94_E01 bis 94_E03')).toEqual([
      { text: 'Raum 94_E01 bis 94_E03', fett: false, kursiv: false },
    ]);
  });

  it('setzt die Sitzplatznummer der Anfangsvorlage groß und fett', () => {
    const bloecke = parseMarkdown(VORLAGE_SITZPLATZ);
    const nummer = bloecke[bloecke.length - 1];
    expect(nummer.art).toBe('ueberschrift');
    expect(nummer.fett).toBe(true);
    expect(nummer.faktor).toBeGreaterThan(1.5);
  });
});
