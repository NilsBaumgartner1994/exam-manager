import { inflateSync } from 'zlib';
import { PDFDocument } from 'pdf-lib';
import {
  erstelleZip,
  nichtDarstellbareZeichen,
  parseRaumschemata,
  sitzplaenePdf,
  sitzplatzPdf,
  sitzplatznummern,
  tabellenPdf,
  verteileImRaum,
  vorlagenPdf,
  winAnsiText,
  zulassungsPdf,
} from '../src';

/**
 * Der Text einer PDF, Zeile für Zeile. Die Seiteninhalte sind Flate-gepackt
 * und setzen jedes Wort einzeln (`… Tm` mit Position, dann `<hex> Tj`) – für
 * den Test werden die Wörter wieder nach ihrer Zeile gruppiert. Reicht, um zu
 * prüfen, dass der Wortlaut wirklich im Dokument landet.
 */
function pdfZeilen(pdf: Uint8Array): string[] {
  const roh = Buffer.from(pdf);
  const zeilen: string[] = [];
  for (const treffer of roh.toString('latin1').matchAll(/stream\r?\n/g)) {
    const start = treffer.index! + treffer[0].length;
    const ende = roh.indexOf('endstream', start, 'latin1');
    let inhalt: string;
    try {
      inhalt = inflateSync(roh.subarray(start, ende)).toString('latin1');
    } catch {
      continue;
    }
    const worte = new Map<string, { x: number; text: string }[]>();
    const muster = /1 0 0 1 ([\d.]+) ([\d.]+) Tm\s*<([0-9A-Fa-f]+)> Tj/g;
    for (const wort of inhalt.matchAll(muster)) {
      const zeile = worte.get(wort[2]) ?? [];
      zeile.push({ x: Number(wort[1]), text: Buffer.from(wort[3], 'hex').toString('latin1') });
      worte.set(wort[2], zeile);
    }
    for (const [, zeile] of worte) {
      zeilen.push(zeile.sort((a, b) => a.x - b.x).map((wort) => wort.text).join(' '));
    }
  }
  return zeilen;
}

const ZULASSUNG = {
  nachname: 'Schrödinger', vorname: 'Erwin', matrikelnummer: '1000005', email: 'erwin@test.de',
};

describe('PDF und ZIP (Screen 2 + 4)', () => {
  it('erzeugt ein Zulassungs-PDF (auch mit Umlauten)', async () => {
    const pdf = await zulassungsPdf(ZULASSUNG);
    expect(pdf.length).toBeGreaterThan(500);
    expect(String.fromCharCode(...pdf.slice(0, 5))).toBe('%PDF-');
  });

  it('erzeugt ein Sitzplatz-PDF mit Anrede, Hinweisen und Sitzplatznummer', async () => {
    const pdf = await sitzplatzPdf({
      anfangNachname: 'S', sitzplatznummer: 1001, raum: '94/E01', raumSchluessel: '94/E01',
      reservierteZeit: '01.02.2026 Gruppe 1: ca. 09:15 Uhr = Einlassstart',
      matrikelnummer: '1000005', anwesend: '',
      nachname: 'Schrödinger', vorname: 'Erwin', zeitUndRaum: '01.02.2026 09:30 - 94/E01',
      email: 'erwin@test.de',
    });
    expect(String.fromCharCode(...pdf.slice(0, 5))).toBe('%PDF-');

    const text = pdfZeilen(pdf).join('\n');
    expect(text).toContain('Klausur Information');
    expect(text).toContain('Liebe/r Erwin,');
    expect(text).toContain('Stud.IP-Login');
    expect(text).toContain('EXA-Anmeldenachweis');
    expect(text).toContain('Datum / Gruppe / Zeiten:');
    expect(text).toContain('01.02.2026 Gruppe 1: ca. 09:15 Uhr = Einlassstart');
    expect(text).toContain('Raum:');
    expect(text).toContain('94/E01');
    // Die Nummer steht als eigene Zeile am Ende – groß und fett auf dem Blatt.
    const zeilen = pdfZeilen(pdf);
    expect(zeilen[zeilen.length - 1]).toBe('SITZPLATZNUMMER: 1001');
  });

  it('setzt eine eigene Vorlage statt des Anfangstexts', async () => {
    const pdf = await sitzplatzPdf(
      {
        anfangNachname: 'S', sitzplatznummer: 7, raum: '94/E01', raumSchluessel: '94/E01',
        reservierteZeit: 'morgen', matrikelnummer: '1000005', anwesend: '',
        nachname: 'Schrödinger', vorname: 'Erwin', zeitUndRaum: '', email: 'erwin@test.de',
      },
      '# Hallo <Vorname>\n\nDu sitzt in <Raum> auf Platz <Sitzplatznummer>.',
    );
    const text = pdfZeilen(pdf).join('\n');
    expect(text).toContain('Hallo Erwin');
    expect(text).toContain('Du sitzt in 94/E01 auf Platz 7.');
    // Vom Anfangstext darf nichts übrig sein.
    expect(text).not.toContain('Klausur Information');
  });

  it('verteilt eine lange Vorlage auf mehrere Seiten', async () => {
    // Die Vorlage kann jeder ändern – ein zu langer Text darf nicht unten aus
    // dem Blatt laufen.
    const lang = Array.from({ length: 120 }, (_, i) => `Zeile ${i + 1}`).join('\n');
    expect((await PDFDocument.load(await vorlagenPdf(lang))).getPageCount()).toBeGreaterThan(1);
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
    const pdf = await sitzplaenePdf([{
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
    }]);
    expect(String.fromCharCode(...pdf.slice(0, 5))).toBe('%PDF-');
    expect(pdf.length).toBeGreaterThan(500);
  });

  it('zeichnet den Sitzplan auch gedreht und ohne Belegung', async () => {
    const pdf = await sitzplaenePdf([{ schema, titel: '94/E01', drehungen: 1 }]);
    expect(String.fromCharCode(...pdf.slice(0, 5))).toBe('%PDF-');
  });

  it('setzt mehrere Sitzpläne in eine PDF – je Raumeinsatz eine Seite', async () => {
    const pdf = await sitzplaenePdf([
      { schema, titel: '94/E01' },
      { schema, titel: '94/E01 · 2. Durchgang', untertitel: '01.02.2026' },
      { schema, titel: '94/E02', drehungen: 2 },
    ]);
    expect(String.fromCharCode(...pdf.slice(0, 5))).toBe('%PDF-');
    expect((await PDFDocument.load(pdf)).getPageCount()).toBe(3);
  });

  it('gibt auch ohne Sitzpläne eine PDF mit einer Seite zurück', async () => {
    const pdf = await sitzplaenePdf([]);
    expect((await PDFDocument.load(pdf)).getPageCount()).toBe(1);
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
