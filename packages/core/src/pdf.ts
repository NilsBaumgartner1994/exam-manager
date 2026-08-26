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

/**
 * Zeichen, die die eingebauten PDF-Schriften darstellen können (WinAnsi bzw.
 * CP1252). Deutsche Umlaute, ß und die meisten westeuropäischen Akzente sind
 * dabei; alles darüber hinaus – „ź“, „ł“, kyrillisch, griechisch – nicht.
 */
const WINANSI = new Set<string>([
  // 0x20–0x7E (ASCII) und 0xA0–0xFF (Latin-1)
  ...Array.from({ length: 0x7f - 0x20 }, (_, i) => String.fromCharCode(0x20 + i)),
  ...Array.from({ length: 0x100 - 0xa0 }, (_, i) => String.fromCharCode(0xa0 + i)),
  // 0x80–0x9F: die Sonderzeichen, die CP1252 gegenüber Latin-1 zusätzlich hat
  ...'€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ',
]);

/**
 * Buchstaben ohne Akzent, den man abtrennen könnte – hier hilft nur eine
 * Ersetzung von Hand.
 */
const ERSATZ: Record<string, string> = {
  Đ: 'D', đ: 'd', Ð: 'D', Ħ: 'H', ħ: 'h', Ł: 'L', ł: 'l', Ŋ: 'N', ŋ: 'n',
  Ŧ: 'T', ŧ: 't', ı: 'i', İ: 'I', ĸ: 'k', ẞ: 'SS', Ə: 'E', ə: 'e', ſ: 's',
};

/**
 * Text so umschreiben, dass ihn eine Standard-PDF-Schrift setzen kann.
 *
 * pdf-lib bricht sonst mit „WinAnsi cannot encode …“ ab – und ein Abbruch
 * mitten im Stapel ist schlimmer als ein Name ohne diakritisches Zeichen.
 * Deshalb: erst versuchen, das Zeichen zu zerlegen und nur den Akzent
 * wegzulassen (`ź` → `z`, `č` → `c`), dann die Tabelle oben (`ł` → `l`), und
 * erst wenn beides nichts hergibt, ein `?`.
 *
 * Umlaute und ß bleiben unangetastet – die kann WinAnsi darstellen.
 */
export function winAnsiText(text: string): string {
  const darstellbar = (kandidat: string) =>
    kandidat !== '' && [...kandidat].every((zeichen) => WINANSI.has(zeichen));

  let ergebnis = '';
  for (const zeichen of text) {
    if (WINANSI.has(zeichen)) {
      ergebnis += zeichen;
      continue;
    }
    // Erst den Akzent abtrennen, dann die Tabelle, dann aufgeben. `ł` zerfällt
    // nicht – die Zerlegung liefert das Zeichen unverändert zurück und ist
    // damit genauso wenig darstellbar wie vorher.
    const ohneAkzent = zeichen.normalize('NFD').replace(/\p{M}/gu, '');
    const ersatz = [ohneAkzent, ERSATZ[zeichen] ?? ''].find(darstellbar);
    ergebnis += ersatz ?? '?';
  }
  return ergebnis;
}

/** Zeichen eines Textes, die eine Standard-PDF-Schrift nicht darstellen kann. */
export function nichtDarstellbareZeichen(text: string): string[] {
  return [...new Set([...text].filter((zeichen) => !WINANSI.has(zeichen)))];
}

async function textPdf(rohAbsaetze: string[]): Promise<Uint8Array> {
  const absaetze = rohAbsaetze.map(winAnsiText);
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
