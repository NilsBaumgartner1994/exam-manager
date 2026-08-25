import { erstelleZip, sitzplatzPdf, zulassungsPdf } from '../src';

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
      anfangNachname: 'S', sitzplatznummer: 1001, raum: '94/E01',
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
