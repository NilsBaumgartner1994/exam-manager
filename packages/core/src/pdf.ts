/**
 * PDF-Erzeugung im Browser oder in Node (pdf-lib, keine Server-Abhängigkeit).
 * Portierung von `2_b_studip_klausureinsicht_zulassung.py` und
 * `2_generate_studip_pdfs.py`.
 */
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { PLAN_ANZEIGE_STANDARD, PlanAnzeige, Platzbelegung, platzSchluessel } from './raumbelegung';
import { anzeigeBereich, anzeigeRaster, Raumschema, ZellTyp } from './raumschema';
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

/** Ein Absatz einer Text-PDF – ohne weitere Angaben Fließtext in Helvetica. */
export interface TextAbsatz {
  text: string;
  /** Halbfett – für Überschriften und die Sitzplatznummer. */
  fett?: boolean;
  /** Schriftgröße in Punkt (Vorgabe: die des Fließtexts). */
  groesse?: number;
  /** Leerzeilen über dem Absatz. */
  abstandOben?: number;
}

interface TextPdfOptionen {
  /** Schriftgröße des Fließtexts. */
  groesse?: number;
  /** Abstand von Zeile zu Zeile. */
  zeilenhoehe?: number;
  /** Abstand nach jedem Absatz, in Zeilen. */
  absatzAbstand?: number;
}

async function textPdf(
  rohAbsaetze: (string | TextAbsatz)[],
  optionen: TextPdfOptionen = {},
): Promise<Uint8Array> {
  const { groesse = FONT_SIZE, zeilenhoehe = LINE_HEIGHT, absatzAbstand = 0.5 } = optionen;
  const doc = await PDFDocument.create();
  const page = doc.addPage([A4.width, A4.height]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fett = await doc.embedFont(StandardFonts.HelveticaBold);
  const maxWidth = A4.width - 2 * MARGIN;
  let y = A4.height - 80;

  for (const roh of rohAbsaetze) {
    const absatz: TextAbsatz = typeof roh === 'string' ? { text: roh } : roh;
    const schrift = absatz.fett ? fett : font;
    const schriftgroesse = absatz.groesse ?? groesse;
    // Größerer Text braucht mehr Luft, sonst berühren sich die Zeilen.
    const hoehe = schriftgroesse === groesse ? zeilenhoehe : schriftgroesse * 1.3;

    y -= (absatz.abstandOben ?? 0) * zeilenhoehe;
    for (const zeile of wrap(winAnsiText(absatz.text), schrift, schriftgroesse, maxWidth)) {
      page.drawText(zeile, {
        x: MARGIN, y, size: schriftgroesse, font: schrift, color: rgb(0, 0, 0),
      });
      y -= hoehe;
    }
    y -= absatzAbstand * zeilenhoehe;
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

/**
 * Raum-/Sitzplatz-PDF (`<Matrikelnummer>.pdf`) mit den Klausurinformationen –
 * derselbe Wortlaut wie in `2_generate_studip_pdfs.py`. Die Sitzplatznummer
 * steht groß und fett am Ende: Sie ist das, was am Prüfungstag gesucht wird.
 */
export async function sitzplatzPdf(platz: Sitzplatz): Promise<Uint8Array> {
  return textPdf(
    [
      { text: 'Klausur Information', fett: true, groesse: 14 },
      { text: `Liebe/r ${platz.vorname},`, abstandOben: 0.5 },
      {
        text: 'Sie haben sich für die Klausur angemeldet. Bitte beachten Sie folgende Informationen:',
        abstandOben: 0.5,
      },
      '- Um an der Prüfung teilnehmen zu können, müssen Sie unbedingt Ihr Stud.IP-Login ' +
        '(User und Passwort) auswendig wissen.',
      'Tipp: Passen Sie Ihr Passwort ggf. vor der Prüfung temporär so an, dass Sie es sich ' +
        'sicher merken können.',
      '- Bitte halten Sie zu Beginn und während der Prüfung Ihren Studierendenausweis / ' +
        'Ihre Immatrikulationsbescheinigung (und ggf. den EXA-Anmeldenachweis) bereit.',
      '- Bitte kommen Sie mit etwas zeitlichem Vorlauf zum Prüfungsraum und planen Sie am ' +
        'Ende zusätzliche Zeit ein, da am Anfang etwas Zeit für Organisatorisches benötigt wird.',
      { text: 'Datum / Gruppe / Zeiten:', abstandOben: 0.5 },
      platz.reservierteZeit,
      { text: 'Raum:', abstandOben: 0.5 },
      platz.raum,
      {
        text: `SITZPLATZNUMMER: ${platz.sitzplatznummer}`,
        fett: true,
        groesse: 18,
        abstandOben: 1.5,
      },
    ],
    { groesse: 11, zeilenhoehe: 14, absatzAbstand: 0 },
  );
}

// ---------------------------------------------------------------------------
// Sitzplan und Listen als PDF
//
// Gedruckt wird nicht die Bildschirmansicht, sondern dasselbe Raster noch
// einmal mit pdf-lib: So entstehen einzelne Dateien (je Raum ein Sitzplan,
// dazu Aushang, Dozenten- und Tutorenliste), statt dass der Druckdialog für
// jede davon einmal geöffnet werden muss.
// ---------------------------------------------------------------------------

/** Querformat – ein Hörsaal ist breiter als hoch. */
const A4_QUER = { width: A4.height, height: A4.width };

/** Farben des Rasters, abgestimmt auf die Ansicht in der App. */
const PLAN_FARBEN: Record<ZellTyp, { fuellung: ReturnType<typeof rgb>; rand: ReturnType<typeof rgb> } | null> = {
  leer: null,
  tisch: { fuellung: rgb(0.953, 0.886, 0.78), rand: rgb(0.725, 0.545, 0.322) },
  reserve: { fuellung: rgb(1, 1, 1), rand: rgb(0.725, 0.545, 0.322) },
  pult: { fuellung: rgb(0.788, 0.631, 0.451), rand: rgb(0.478, 0.325, 0.153) },
  tuer: { fuellung: rgb(0.863, 0.988, 0.906), rand: rgb(0.082, 0.502, 0.239) },
  wand: { fuellung: rgb(0.278, 0.333, 0.412), rand: rgb(0.278, 0.333, 0.412) },
};

export interface SitzplanPdfOptionen {
  /** Raster des Raums (mit seinen Textfeldern). */
  schema: Raumschema;
  /** Überschrift, z. B. „94/E01 · 2. Durchgang“. */
  titel: string;
  /** Zweite Zeile, z. B. die reservierte Zeit. */
  untertitel?: string;
  /** Belegung dieses Raumeinsatzes. */
  belegung?: Platzbelegung[];
  /** Sitzplatznummern je `platzSchluessel`. */
  nummern?: Map<string, number>;
  /** Personen je Matrikelnummer. */
  personen?: Map<string, Sitzplatz>;
  /** Schlüssel des Raumeinsatzes für `platzSchluessel` (Vorgabe: Raumname). */
  schluessel?: string;
  /** Drehung der Ansicht wie am Bildschirm. */
  drehungen?: number;
  anzeige?: PlanAnzeige;
}

/**
 * Die Sitzpläne als PDF – dasselbe Raster wie am Bildschirm, einschließlich
 * Drehung, Textfeldern und dem, was die Anzeige-Häkchen in die Kästen
 * schreiben. Jeder Raumeinsatz beginnt auf einer **neuen Seite**, wie bei den
 * Listen aus `tabellenPdf()`: So kommt aus Schritt 4 eine Datei heraus und
 * kein Stapel einzelner Dateien.
 */
export async function sitzplaenePdf(plaene: SitzplanPdfOptionen[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fett = await doc.embedFont(StandardFonts.HelveticaBold);

  for (const optionen of plaene) zeichneSitzplan(doc, font, fett, optionen);

  // Eine PDF ohne Seiten lässt sich nicht öffnen – lieber ein leeres Blatt.
  if (doc.getPageCount() === 0) doc.addPage([A4_QUER.width, A4_QUER.height]);
  return doc.save();
}

/** Einen Sitzplan auf eine eigene Seite des Dokuments zeichnen. */
function zeichneSitzplan(
  doc: PDFDocument,
  font: import('pdf-lib').PDFFont,
  fett: import('pdf-lib').PDFFont,
  optionen: SitzplanPdfOptionen,
): void {
  const {
    schema,
    titel,
    untertitel,
    belegung = [],
    nummern = new Map<string, number>(),
    personen = new Map<string, Sitzplatz>(),
    schluessel = schema.raum,
    drehungen = 0,
    anzeige = PLAN_ANZEIGE_STANDARD,
  } = optionen;

  const seite = doc.addPage([A4_QUER.width, A4_QUER.height]);

  seite.drawText(winAnsiText(titel), {
    x: MARGIN, y: A4_QUER.height - MARGIN, size: 16, font: fett, color: rgb(0, 0, 0),
  });
  if (untertitel) {
    seite.drawText(winAnsiText(untertitel), {
      x: MARGIN, y: A4_QUER.height - MARGIN - 18, size: 10, font, color: rgb(0.32, 0.38, 0.44),
    });
  }

  const raster = anzeigeRaster(schema, drehungen);
  const zeilen = raster.length;
  const spalten = raster[0]?.length ?? 0;
  if (zeilen === 0 || spalten === 0) return;

  const obenFrei = MARGIN + (untertitel ? 44 : 30);
  const platzBreite = A4_QUER.width - 2 * MARGIN;
  const platzHoehe = A4_QUER.height - MARGIN - obenFrei;
  // Zellen sind halb so hoch wie breit – es sind Tische, keine Quadrate. Auf
  // dem Papier dürfen sie höher werden, wenn der Raum breit ist und sonst die
  // untere Seitenhälfte leer bliebe; quadratisch ist die Grenze.
  const breite = Math.min(platzBreite / spalten, (platzHoehe / zeilen) * 2);
  const hoehe = Math.min(platzHoehe / zeilen, breite);
  const fuge = Math.min(2, breite * 0.06);
  const x0 = MARGIN + (platzBreite - breite * spalten) / 2;
  const y0 = A4_QUER.height - obenFrei;

  const zellRechteck = (zeile: number, spalte: number) => ({
    x: x0 + spalte * breite,
    y: y0 - (zeile + 1) * hoehe,
    width: breite,
    height: hoehe,
  });

  for (let z = 0; z < zeilen; z++) {
    for (let s = 0; s < spalten; s++) {
      const zelle = raster[z][s];
      const farbe = PLAN_FARBEN[zelle.typ];
      if (!farbe) continue;
      const rechteck = zellRechteck(z, s);
      const gefugt = zelle.typ === 'wand' ? 0 : fuge / 2;
      seite.drawRectangle({
        x: rechteck.x + gefugt,
        y: rechteck.y + gefugt,
        width: rechteck.width - 2 * gefugt,
        height: rechteck.height - 2 * gefugt,
        color: farbe.fuellung,
        borderColor: farbe.rand,
        borderWidth: 0.5,
      });

      const platz = belegung.find(
        (b) => b.raum === schluessel && b.zeile === zelle.zeile && b.spalte === zelle.spalte,
      );
      const person = platz?.matrikelnummer ? personen.get(platz.matrikelnummer) : undefined;
      const nummer = nummern.get(platzSchluessel(schluessel, zelle.zeile, zelle.spalte));
      const texte = zellTexte(zelle.typ, anzeige, { platz, person, nummer });
      if (texte.length === 0) continue;

      const groesse = Math.max(3.5, Math.min(hoehe / (texte.length + 0.6), breite / 4.5));
      texte.forEach((text, i) => {
        const gekuerzt = kuerzeAufBreite(winAnsiText(text), font, groesse, rechteck.width - 2);
        seite.drawText(gekuerzt, {
          x: rechteck.x + (rechteck.width - font.widthOfTextAtSize(gekuerzt, groesse)) / 2,
          y: rechteck.y + rechteck.height - (i + 1) * groesse * 1.15 + groesse * 0.25,
          size: groesse,
          font,
          color: rgb(0.12, 0.16, 0.2),
        });
      });
    }
  }

  // Textfelder liegen über dem Raster – wie am Bildschirm.
  for (const beschriftung of schema.beschriftungen) {
    const bereich = anzeigeBereich(beschriftung, schema, drehungen);
    const ecke = zellRechteck(bereich.zeile, bereich.spalte);
    const feld = {
      x: ecke.x,
      y: ecke.y - (bereich.hoehe - 1) * hoehe,
      width: bereich.breite * breite,
      height: bereich.hoehe * hoehe,
    };
    const groesse = Math.max(4, Math.min(feld.height * 0.5, breite * 0.5));
    const text = kuerzeAufBreite(winAnsiText(beschriftung.text), fett, groesse, feld.width - 2);
    if (text === '') continue;
    seite.drawText(text, {
      x: feld.x + (feld.width - fett.widthOfTextAtSize(text, groesse)) / 2,
      y: feld.y + feld.height / 2 - groesse * 0.35,
      size: groesse,
      font: fett,
      color: rgb(0.12, 0.16, 0.2),
    });
  }
}

/** Was in einem Kasten steht – dieselbe Reihenfolge wie am Bildschirm. */
function zellTexte(
  typ: ZellTyp,
  anzeige: PlanAnzeige,
  inhalt: { platz?: Platzbelegung; person?: Sitzplatz; nummer?: number },
): string[] {
  if (typ === 'pult') return anzeige.pultText ? ['Pult'] : [];
  if (typ === 'tuer') return ['Tür'];
  if (typ === 'reserve') return ['Reserve'];
  if (typ !== 'tisch') return [];

  // Dieselbe Reihenfolge wie am Bildschirm: erst wer, dann welche Nummer.
  const texte: string[] = [];
  if (inhalt.platz?.reserviert) {
    texte.push('Reserve');
  } else if (inhalt.person) {
    if (anzeige.namensPraefix) texte.push(inhalt.person.anfangNachname);
    if (anzeige.matrikelnummer) texte.push(inhalt.person.matrikelnummer);
  }
  if (anzeige.sitzplatznummer && inhalt.nummer !== undefined) texte.push(String(inhalt.nummer));
  return texte;
}

/** Text so weit kürzen, dass er in die Breite passt (mit „…“ am Ende). */
function kuerzeAufBreite(
  text: string,
  font: import('pdf-lib').PDFFont,
  groesse: number,
  maxBreite: number,
): string {
  if (maxBreite <= 0 || text === '') return '';
  if (font.widthOfTextAtSize(text, groesse) <= maxBreite) return text;
  let kurz = text;
  while (kurz.length > 1 && font.widthOfTextAtSize(`${kurz}.`, groesse) > maxBreite) {
    kurz = kurz.slice(0, -1);
  }
  return kurz.length > 1 ? `${kurz}.` : kurz;
}

/** Ein Abschnitt einer Listen-PDF – jeder beginnt auf einer neuen Seite. */
export interface TabellenAbschnitt {
  titel: string;
  untertitel?: string;
  spalten: string[];
  zeilen: (string | number)[][];
}

/**
 * Listen als PDF: je Abschnitt eine neue Seite, lange Tabellen laufen über
 * mehrere Seiten weiter. Damit entstehen Aushang, Dozenten- und Tutorenliste
 * aus denselben Daten wie die Tabellen am Bildschirm.
 */
export async function tabellenPdf(abschnitte: TabellenAbschnitt[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fett = await doc.embedFont(StandardFonts.HelveticaBold);
  const groesse = 10;
  const zeilenHoehe = 16;
  const maxBreite = A4.width - 2 * MARGIN;

  for (const abschnitt of abschnitte) {
    const spalten = abschnitt.spalten.map(winAnsiText);
    const zeilen = abschnitt.zeilen.map((zeile) => zeile.map((wert) => winAnsiText(String(wert))));
    // Spaltenbreiten aus dem breitesten Eintrag, zusammen auf die Seitenbreite
    // gestreckt – so bleibt eine Sitzplatznummer schmal und ein Name breit.
    const roh = spalten.map((titel, i) =>
      Math.max(
        fett.widthOfTextAtSize(titel, groesse),
        ...zeilen.map((zeile) => font.widthOfTextAtSize(zeile[i] ?? '', groesse)),
      ) + 12,
    );
    const summe = roh.reduce((a, b) => a + b, 0) || 1;
    const breiten = roh.map((breite) => (breite / summe) * maxBreite);

    let seite = doc.addPage([A4.width, A4.height]);
    let y = A4.height - MARGIN;
    const kopf = (mitTitel: boolean) => {
      if (mitTitel) {
        seite.drawText(winAnsiText(abschnitt.titel), {
          x: MARGIN, y, size: 15, font: fett, color: rgb(0, 0, 0),
        });
        y -= 18;
        if (abschnitt.untertitel) {
          seite.drawText(winAnsiText(abschnitt.untertitel), {
            x: MARGIN, y, size: 10, font, color: rgb(0.32, 0.38, 0.44),
          });
          y -= 14;
        }
        y -= 6;
      }
      let x = MARGIN;
      spalten.forEach((titel, i) => {
        seite.drawText(titel, { x, y, size: groesse, font: fett, color: rgb(0, 0, 0) });
        x += breiten[i];
      });
      y -= 4;
      seite.drawLine({
        start: { x: MARGIN, y: y - 2 },
        end: { x: MARGIN + maxBreite, y: y - 2 },
        thickness: 0.5,
        color: rgb(0.7, 0.74, 0.78),
      });
      y -= zeilenHoehe - 4;
    };
    kopf(true);

    for (const zeile of zeilen) {
      if (y < MARGIN + zeilenHoehe) {
        seite = doc.addPage([A4.width, A4.height]);
        y = A4.height - MARGIN;
        kopf(false);
      }
      let x = MARGIN;
      zeile.forEach((wert, i) => {
        seite.drawText(kuerzeAufBreite(wert, font, groesse, breiten[i] - 6), {
          x, y, size: groesse, font, color: rgb(0.12, 0.16, 0.2),
        });
        x += breiten[i];
      });
      y -= zeilenHoehe;
    }
  }

  if (doc.getPageCount() === 0) doc.addPage([A4.width, A4.height]);
  return doc.save();
}
