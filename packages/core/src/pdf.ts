/**
 * PDF-Erzeugung im Browser oder in Node (pdf-lib, keine Server-Abhängigkeit).
 * Portierung von `2_b_studip_klausureinsicht_zulassung.py` und
 * `2_generate_studip_pdfs.py`.
 */
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { Sitzplatz, Zulassung } from './types';

const A4 = { width: 595.28, height: 841.89 };
const MARGIN = 50;
const FONT_SIZE = 12;
const LINE_HEIGHT = 18;

async function textPdf(absaetze: string[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([A4.width, A4.height]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const maxWidth = A4.width - 2 * MARGIN;
  let y = A4.height - 80;

  for (const absatz of absaetze) {
    for (const zeile of wrap(absatz, font, FONT_SIZE, maxWidth)) {
      page.drawText(zeile, { x: MARGIN, y, size: FONT_SIZE, font, color: rgb(0, 0, 0) });
      y -= LINE_HEIGHT;
    }
    y -= LINE_HEIGHT / 2; // Absatzabstand
  }
  return doc.save();
}

function wrap(text: string, font: import('pdf-lib').PDFFont, size: number, maxWidth: number): string[] {
  if (text === '') return [''];
  const woerter = text.split(' ');
  const zeilen: string[] = [];
  let aktuelle = '';
  for (const wort of woerter) {
    const test = aktuelle === '' ? wort : `${aktuelle} ${wort}`;
    if (font.widthOfTextAtSize(test, size) <= maxWidth) {
      aktuelle = test;
    } else {
      if (aktuelle !== '') zeilen.push(aktuelle);
      aktuelle = wort;
    }
  }
  zeilen.push(aktuelle);
  return zeilen;
}

/** Zulassungs-PDF (`<Matrikelnummer>.pdf`) für die Stud.IP-„Klausureinsicht“. */
export async function zulassungsPdf(zulassung: Zulassung): Promise<Uint8Array> {
  return textPdf([
    'Klausurzulassung',
    '',
    'Dies ist eine automatisch generierte Datei und soll Sie darüber informieren, ' +
      `dass Sie ${zulassung.vorname} ${zulassung.nachname} ${zulassung.matrikelnummer} ` +
      `${zulassung.email} zur Klausur zugelassen sind.`,
  ]);
}

/** Raum-/Sitzplatz-PDF (`<Matrikelnummer>.pdf`) mit den Klausurinformationen. */
export async function sitzplatzPdf(platz: Sitzplatz): Promise<Uint8Array> {
  return textPdf([
    'Klausur Information',
    '',
    `Liebe/r ${platz.vorname},`,
    '',
    'Sie haben sich für die Klausur angemeldet. Bitte beachten Sie folgende Informationen:',
    '',
    '- Um an der Prüfung teilnehmen zu können, müssen Sie unbedingt Ihr Stud.IP-Login ' +
      '(User und Passwort) auswendig wissen.',
    '- Bitte bringen Sie Ihren Studierendenausweis und ein Ausweisdokument mit.',
    '',
    `Raum: ${platz.raum}`,
    `Sitzplatznummer: ${platz.sitzplatznummer}`,
    `Zeit: ${platz.reservierteZeit}`,
  ]);
}
