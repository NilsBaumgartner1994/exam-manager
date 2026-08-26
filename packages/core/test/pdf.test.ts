import {
  erstelleZip,
  nichtDarstellbareZeichen,
  parseRaumschemata,
  sitzplanPdf,
  sitzplatzPdf,
  sitzplatznummern,
  tabellenPdf,
  verteileImRaum,
  winAnsiText,
  zulassungsPdf,
} from '../src';

const ZULASSUNG = {
  nachname: 'Schrödinger', vorname: 'Erwin', matrikelnummer: '1000005', email: 'erwin@test.de',
};

describe('PDF und ZIP (Screen 2 + 4)', () => {
  it('erzeugt ein Zulassungs-PDF (auch mit Umlauten)', async () => {
    const pdf = await zulassungsPdf(ZULASSUNG);
    expect(pdf.length).toBeGreaterThan(500);
    expect(String.fromCharCode(...pdf.slice(0, 5))).toBe('%PDF-');
  });

  it('erzeugt ein Sitzplatz-PDF', async () => {
    const pdf = await sitzplatzPdf({
      anfangNachname: 'S', sitzplatznummer: 1001, raum: '94/E01', raumSchluessel: '94/E01',
      reservierteZeit: '01.02.2026 09:30', matrikelnummer: '1000005', anwesend: '',
      nachname: 'Schrödinger', vorname: 'Erwin', zeitUndRaum: '01.02.2026 09:30 - 94/E01',
      email: 'erwin@test.de',
    });
    expect(String.fromCharCode(...pdf.slice(0, 5))).toBe('%PDF-');
  });

  it('bündelt PDFs in ein ZIP mit <Matrikelnummer>.pdf', async () => {
    const pdf = await zulassungsPdf(ZULASSUNG);
    const zip = await erstelleZip(new Map([['1000005.pdf', pdf]]));
    // ZIP-Magic "PK"
    expect(zip[0]).toBe(0x50);
    expect(zip[1]).toBe(0x4b);
  });
});

describe('Sonderzeichen in Namen', () => {
  it('erzeugt ein PDF für Namen, an denen pdf-lib sonst abbricht', async () => {
    // „WinAnsi cannot encode ź (0x017a)“ – der Fehler, der einen ganzen
    // Stapel scheitern ließ.
    const pdf = await zulassungsPdf({
      nachname: 'Woźniak', vorname: 'Michał', matrikelnummer: '1000011', email: 'michal@test.de',
    });
    expect(String.fromCharCode(...pdf.slice(0, 5))).toBe('%PDF-');
  });

  it('lässt Umlaute und westeuropäische Akzente stehen', () => {
    expect(winAnsiText('Schrödinger Müller Straße')).toBe('Schrödinger Müller Straße');
    expect(winAnsiText('Émile Cañas Ångström')).toBe('Émile Cañas Ångström');
  });

  it('nimmt nur den Akzent weg, wenn das Zeichen fehlt', () => {
    expect(winAnsiText('Woźniak')).toBe('Wozniak');
    // á und ž bleiben – CP1252 kennt beide; ř, Č und ć nicht.
    expect(winAnsiText('Dvořák Čapek Ružić')).toBe('Dvorák Capek Ružic');
    expect(winAnsiText('Michał Łukasz')).toBe('Michal Lukasz');
  });

  it('setzt ein Fragezeichen, wo gar nichts passt', () => {
    expect(winAnsiText('Иванов')).toBe('??????');
    expect(winAnsiText('李')).toBe('?');
  });

  it('meldet, welche Zeichen ersetzt werden mussten', () => {
    expect(nichtDarstellbareZeichen('Woźniak')).toEqual(['ź']);
    expect(nichtDarstellbareZeichen('Schrödinger')).toEqual([]);
  });

  it('schreibt jedes Zeichen, das es durchlässt, auch wirklich ins PDF', async () => {
    // Der Test, der die Zeichenliste ehrlich hält: Alles, was winAnsiText
    // stehen lässt, muss pdf-lib auch setzen können.
    const alle = Array.from({ length: 0x2020 }, (_, i) => String.fromCharCode(i))
      .map((zeichen) => winAnsiText(zeichen))
      .join('');
    const pdf = await zulassungsPdf({
      nachname: alle, vorname: '', matrikelnummer: '1', email: '',
    });
    expect(String.fromCharCode(...pdf.slice(0, 5))).toBe('%PDF-');
  });
});

describe('Sitzplan und Listen als PDF (Screen 4)', () => {
  const schema = parseRaumschemata('Raum;94/E01\nW;W;W\nP;T;R\n.;T;T\nText;0;0;1;3;Tafel\n')[0];

  it('zeichnet den Sitzplan eines Raums', async () => {
    const { belegung } = verteileImRaum(schema, ['1000005'], []);
    const pdf = await sitzplanPdf({
      schema,
      titel: '94/E01 · 2. Durchgang',
      untertitel: '01.02.2026 – Gruppe 2',
      belegung,
      nummern: sitzplatznummern([schema], 1001),
      personen: new Map([
        [
          '1000005',
          {
            anfangNachname: 'Schr',
            sitzplatznummer: 1001,
            raum: '94/E01',
            raumSchluessel: '94/E01',
            reservierteZeit: '',
            matrikelnummer: '1000005',
            anwesend: '',
            nachname: 'Schrödinger',
            vorname: 'Erwin',
            zeitUndRaum: '',
            email: '',
          },
        ],
      ]),
    });
    expect(String.fromCharCode(...pdf.slice(0, 5))).toBe('%PDF-');
    expect(pdf.length).toBeGreaterThan(500);
  });

  it('zeichnet den Sitzplan auch gedreht und ohne Belegung', async () => {
    const pdf = await sitzplanPdf({ schema, titel: '94/E01', drehungen: 1 });
    expect(String.fromCharCode(...pdf.slice(0, 5))).toBe('%PDF-');
  });

  it('setzt Listen mit einer Seite je Abschnitt', async () => {
    const pdf = await tabellenPdf([
      {
        titel: 'Aushang 94/E01',
        untertitel: '01.02.2026',
        spalten: ['Sitzplatz', 'Anfang Nachname'],
        zeilen: [[1001, 'Schr'], [1002, 'Ł']],
      },
      { titel: 'Dozentenliste', spalten: ['Sitzplatz', 'Name'], zeilen: [[1001, 'Schrödinger']] },
    ]);
    expect(String.fromCharCode(...pdf.slice(0, 5))).toBe('%PDF-');
    expect(pdf.length).toBeGreaterThan(500);
  });
});
