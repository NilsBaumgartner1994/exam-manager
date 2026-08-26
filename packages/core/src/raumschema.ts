/**
 * Raumschema: Wo stehen im Raum die Tische, wo ist die Tür?
 *
 * Gespeichert wird das als CSV-Raster – eine Zeile der Datei ist eine Reihe im
 * Raum, eine Spalte eine Position darin. Damit bildet die Datei den Aufbau des
 * Raumes direkt ab und lässt sich auch in Excel bearbeiten:
 *
 *     Raum;94/E01
 *     P;.;.;.;.
 *     .;T;T;.;T
 *     .;T;T;.;T
 *     D;.;.;.;.
 *
 * Eine Zeile `Raum;<Name>` beginnt einen neuen Raum, alle weiteren Zeilen sind
 * dessen Raster.
 *
 * Gespeichert wird **je Raum eine Datei**, benannt nach dem Raum
 * (`Raeume/94_E01.csv`): So ist im Projektordner auf einen Blick zu sehen,
 * welche Räume es gibt, und ein einzelner Raum lässt sich weitergeben oder
 * ersetzen, ohne die anderen anzufassen. Mehrere Räume in einer Datei bleiben
 * lesbar – ältere Sammeldateien (`raumschema.csv`) funktionieren weiter.
 *
 * Freier Text über verbundenen Zellen steht in eigenen Zeilen hinter dem
 * Raster – `Text;<Zeile>;<Spalte>;<Höhe>;<Breite>;<Text>`. Das Raster bleibt
 * dadurch ein sauberes Rechteck aus Ein-Zeichen-Kürzeln, und der Text kann
 * beliebig lang sein:
 *
 *     Raum;94/E01
 *     P;.;.;.;.
 *     .;T;T;.;T
 *     Text;0;1;1;4;Bitte Ausweise bereitlegen
 */
import { CSV_DELIMITER, parseCsvRows, toCsv } from './csv';
import { normalizeName } from './namen';

export type ZellTyp = 'leer' | 'tisch' | 'tuer' | 'wand' | 'pult';

/** Kürzel in der CSV – ein Zeichen je Zelle. */
export const ZELL_KUERZEL: Record<ZellTyp, string> = {
  leer: '.',
  tisch: 'T',
  tuer: 'D',
  wand: 'W',
  pult: 'P',
};

const KUERZEL_ZU_TYP: Record<string, ZellTyp> = {
  '.': 'leer',
  '': 'leer',
  T: 'tisch',
  D: 'tuer',
  W: 'wand',
  P: 'pult',
};

/**
 * Freier Text über einem rechteckigen Bereich – „verbundene Zellen“ wie in
 * einer Tabellenkalkulation. Der Text liegt als eigenes Element über dem
 * Raster und kann deshalb beliebig lang sein. Was darunter steht, bleibt
 * stehen: So lässt sich auch eine Tür („Haupteingang“) oder eine Tischreihe
 * („Aufsicht“) beschriften.
 */
export interface Beschriftung extends Bereich {
  text: string;
}

export interface Raumschema {
  raum: string;
  /** Raster [Zeile][Spalte] in kanonischer Ausrichtung (wie gespeichert). */
  zellen: ZellTyp[][];
  /** Textfelder über verbundenen Zellen (kanonische Positionen). */
  beschriftungen: Beschriftung[];
}

/**
 * Spaltenname wie in einer Tabellenkalkulation: 0 → A, 25 → Z, 26 → AA.
 * Zeilen werden dagegen schlicht ab 1 durchnummeriert (`zeilenName`).
 */
export function spaltenName(index: number): string {
  let name = '';
  let rest = Math.max(0, Math.trunc(index));
  for (;;) {
    name = String.fromCharCode(65 + (rest % 26)) + name;
    rest = Math.floor(rest / 26) - 1;
    if (rest < 0) return name;
  }
}

export function zeilenName(index: number): string {
  return String(Math.max(0, Math.trunc(index)) + 1);
}

/** Zelladresse wie „B3“ – für Beschriftungen im Editor. */
export function zellName(zeile: number, spalte: number): string {
  return `${spaltenName(spalte)}${zeilenName(zeile)}`;
}

/** Adresse eines Bereichs wie „B3“ bzw. „B3:E7“. */
export function bereichName(bereich: Bereich): string {
  const von = zellName(bereich.zeile, bereich.spalte);
  if (bereich.hoehe <= 1 && bereich.breite <= 1) return von;
  return `${von}:${zellName(bereich.zeile + bereich.hoehe - 1, bereich.spalte + bereich.breite - 1)}`;
}

export function zeilen(schema: Raumschema): number {
  return schema.zellen.length;
}

export function spalten(schema: Raumschema): number {
  return schema.zellen.reduce((max, zeile) => Math.max(max, zeile.length), 0);
}

/** Alle Raumschemata einer CSV einlesen. */
export function parseRaumschemata(csvText: string): Raumschema[] {
  const schemata: Raumschema[] = [];
  let aktuell: Raumschema | null = null;

  for (const row of parseCsvRows(csvText)) {
    const erste = (row[0] ?? '').trim();
    if (erste.toLowerCase() === 'raum') {
      aktuell = { raum: (row[1] ?? '').trim(), zellen: [], beschriftungen: [] };
      schemata.push(aktuell);
      continue;
    }
    if (aktuell === null) {
      // Raster ohne vorangestellte Raum-Zeile: namenloser Raum.
      aktuell = { raum: '', zellen: [], beschriftungen: [] };
      schemata.push(aktuell);
    }
    // Textfelder stehen in eigenen Zeilen; das Raster kennt nur Ein-Zeichen-Kürzel.
    if (erste.toLowerCase() === TEXT_SCHLUESSEL.toLowerCase()) {
      const beschriftung = parseBeschriftung(row);
      if (beschriftung) aktuell.beschriftungen.push(beschriftung);
      continue;
    }
    aktuell.zellen.push(row.map((zelle) => KUERZEL_ZU_TYP[zelle.trim().toUpperCase()] ?? 'leer'));
  }

  return schemata.map(rechteckig);
}

/** Schlüsselwort der Textzeilen in der CSV. */
const TEXT_SCHLUESSEL = 'Text';

function parseBeschriftung(row: string[]): Beschriftung | null {
  const zahl = (wert: string | undefined, minimum: number) => {
    const n = Number((wert ?? '').trim());
    return Number.isFinite(n) ? Math.max(minimum, Math.trunc(n)) : null;
  };
  const zeile = zahl(row[1], 0);
  const spalte = zahl(row[2], 0);
  const hoehe = zahl(row[3], 1);
  const breite = zahl(row[4], 1);
  if (zeile === null || spalte === null || hoehe === null || breite === null) return null;
  // Der Text darf Semikolon enthalten – alles ab Spalte 5 gehört dazu.
  return { zeile, spalte, hoehe, breite, text: row.slice(5).join(CSV_DELIMITER) };
}

/**
 * Kurze Zeilen mit `leer` auffüllen, damit das Raster rechteckig ist, und
 * Beschriftungen auf das Raster begrenzen.
 */
function rechteckig(schema: Raumschema): Raumschema {
  const breite = spalten(schema);
  return {
    raum: schema.raum,
    zellen: schema.zellen.map((zeile) => {
      const voll = [...zeile];
      while (voll.length < breite) voll.push('leer');
      return voll;
    }),
    beschriftungen: beschnitteneBeschriftungen(schema.beschriftungen, schema.zellen.length, breite),
  };
}

/** Beschriftungen auf ein Raster begrenzen; was ganz draußen liegt, fällt weg. */
function beschnitteneBeschriftungen(
  beschriftungen: Beschriftung[],
  anzahlZeilen: number,
  anzahlSpalten: number,
): Beschriftung[] {
  const beschnitten: Beschriftung[] = [];
  for (const b of beschriftungen) {
    // Verschoben wird nichts: Liegt die obere linke Ecke draußen, fällt das
    // Feld weg, sonst wird nur seine Ausdehnung gekappt.
    if (b.zeile < 0 || b.spalte < 0 || b.zeile >= anzahlZeilen || b.spalte >= anzahlSpalten) continue;
    const hoehe = Math.min(b.hoehe, anzahlZeilen - b.zeile);
    const breite = Math.min(b.breite, anzahlSpalten - b.spalte);
    if (hoehe < 1 || breite < 1) continue;
    beschnitten.push({ zeile: b.zeile, spalte: b.spalte, hoehe, breite, text: b.text });
  }
  return beschnitten;
}

export function raumschemataToCsv(schemata: Raumschema[]): string {
  const rows: string[][] = [];
  for (const schema of schemata) {
    rows.push(['Raum', schema.raum]);
    for (const zeile of schema.zellen) {
      rows.push(zeile.map((typ) => ZELL_KUERZEL[typ]));
    }
    for (const b of schema.beschriftungen) {
      rows.push([TEXT_SCHLUESSEL, String(b.zeile), String(b.spalte), String(b.hoehe), String(b.breite), b.text]);
    }
  }
  return toCsv(rows);
}

/**
 * Dateiname für das Raster eines Raums: `94/E01` → `94_E01.csv`.
 *
 * Raumnamen enthalten Schrägstriche, Leerzeichen und manchmal Umlaute –
 * Dateinamen im Projektordner nicht (siehe AGENTS.md). Der Raumname selbst
 * bleibt in der Datei stehen (`Raum;94/E01`); der Dateiname muss ihn also
 * nicht zurückrechnen können, sondern nur wiedererkennbar sein.
 */
export function raumschemaDateiname(raum: string): string {
  const name = normalizeName(raum)
    .replace(/[^A-Za-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return `${name === '' ? 'raum' : name}.csv`;
}

/**
 * Die Raster als einzelne Dateien: Dateiname → CSV mit genau einem Raum.
 *
 * Zwei Räume können auf denselben Dateinamen fallen (`94/E01` und `94 E01`);
 * der zweite bekommt dann eine laufende Nummer, damit keiner den anderen
 * überschreibt.
 */
export function raumschemaDateien(schemata: Raumschema[]): Map<string, string> {
  const dateien = new Map<string, string>();
  for (const schema of schemata) {
    const basis = raumschemaDateiname(schema.raum);
    let name = basis;
    for (let nummer = 2; dateien.has(name); nummer++) {
      name = basis.replace(/\.csv$/, `_${nummer}.csv`);
    }
    dateien.set(name, raumschemataToCsv([schema]));
  }
  return dateien;
}

/**
 * Raster aus mehreren Dateien einlesen – im Projektordner liegt je Raum eine.
 * Steht ein Raum in zweien (eine alte Sammeldatei neben den Einzeldateien),
 * zählt der erste; sonst stünde derselbe Raum zweimal im Editor.
 */
export function parseRaumschemaDateien(texte: string[]): Raumschema[] {
  const schemata: Raumschema[] = [];
  for (const text of texte) {
    for (const schema of parseRaumschemata(text)) {
      if (!schemata.some((vorhanden) => vorhanden.raum === schema.raum)) schemata.push(schema);
    }
  }
  return schemata;
}

/** Leeres Raster einer bestimmten Größe. */
export function leeresRaumschema(raum: string, anzahlZeilen: number, anzahlSpalten: number): Raumschema {
  return {
    raum,
    zellen: Array.from({ length: anzahlZeilen }, () =>
      Array.from({ length: anzahlSpalten }, (): ZellTyp => 'leer'),
    ),
    beschriftungen: [],
  };
}

/**
 * Vorschlag für einen Raum mit `plaetze` Tischen: Tische in Zweierblöcken mit
 * Gang dazwischen, Pult vorne links, Tür hinten links. Damit lässt sich sofort
 * arbeiten, ohne den Raum von Hand zu zeichnen.
 */
export function standardRaumschema(raum: string, plaetze: number): Raumschema {
  const proReihe = Math.min(4, Math.max(2, Math.ceil(Math.sqrt(Math.max(plaetze, 1)))));
  const reihen = Math.max(1, Math.ceil(Math.max(plaetze, 1) / proReihe));
  // Spalten: je Tisch eine Spalte, nach jedem Zweierblock ein Gang, links ein Rand.
  const spaltenMuster: ('tisch' | 'leer')[] = [];
  for (let i = 0; i < proReihe; i++) {
    if (i > 0 && i % 2 === 0) spaltenMuster.push('leer');
    spaltenMuster.push('tisch');
  }
  const breite = spaltenMuster.length + 1; // + Gang am linken Rand

  const zellen: ZellTyp[][] = [];
  zellen.push(['pult', ...Array.from({ length: breite - 1 }, (): ZellTyp => 'leer')]);
  let vergeben = 0;
  for (let r = 0; r < reihen; r++) {
    const zeile: ZellTyp[] = ['leer'];
    for (const muster of spaltenMuster) {
      if (muster === 'tisch' && vergeben < plaetze) {
        zeile.push('tisch');
        vergeben++;
      } else {
        zeile.push('leer');
      }
    }
    zellen.push(zeile);
  }
  zellen.push(['tuer', ...Array.from({ length: breite - 1 }, (): ZellTyp => 'leer')]);
  return { raum, zellen, beschriftungen: [] };
}

/** Eine Zelle in der Anzeige – kennt ihre kanonische Position im gespeicherten Raster. */
export interface AnzeigeZelle {
  typ: ZellTyp;
  /** Position im gespeicherten Raster (dreht sich nicht mit). */
  zeile: number;
  spalte: number;
}

/**
 * Raster für die Anzeige, um `drehungen` × 90° im Uhrzeigersinn gedreht.
 *
 * Gedreht wird nur die Ansicht: Jede Zelle behält ihre kanonische Position,
 * damit Sitzplatznummern und Belegung von der Blickrichtung unabhängig bleiben.
 */
export function anzeigeRaster(schema: Raumschema, drehungen: number): AnzeigeZelle[][] {
  const basis: AnzeigeZelle[][] = schema.zellen.map((zeile, z) =>
    zeile.map((typ, s) => ({ typ, zeile: z, spalte: s })),
  );
  let raster = basis;
  const schritte = ((drehungen % 4) + 4) % 4;
  for (let i = 0; i < schritte; i++) raster = drehe90(raster);
  return raster;
}

/** Ein Raster um 90° im Uhrzeigersinn drehen. */
function drehe90(raster: AnzeigeZelle[][]): AnzeigeZelle[][] {
  const hoehe = raster.length;
  const breite = hoehe === 0 ? 0 : raster[0].length;
  return Array.from({ length: breite }, (_, s) =>
    Array.from({ length: hoehe }, (_, z) => raster[hoehe - 1 - z][s]),
  );
}

/**
 * Eine kanonische Position in Anzeige-Koordinaten umrechnen – dieselbe Drehung
 * wie `anzeigeRaster`, nur als Formel. Wird für alles gebraucht, was über dem
 * Raster liegt (Auswahlrahmen, Textfelder) und deshalb nicht Zelle für Zelle
 * gesucht werden kann.
 */
export function anzeigePosition(
  zeile: number,
  spalte: number,
  anzahlZeilen: number,
  anzahlSpalten: number,
  drehungen: number,
): { zeile: number; spalte: number } {
  switch (((drehungen % 4) + 4) % 4) {
    case 1:
      return { zeile: spalte, spalte: anzahlZeilen - 1 - zeile };
    case 2:
      return { zeile: anzahlZeilen - 1 - zeile, spalte: anzahlSpalten - 1 - spalte };
    case 3:
      return { zeile: anzahlSpalten - 1 - spalte, spalte: zeile };
    default:
      return { zeile, spalte };
  }
}

/** Ein Bereich in Anzeige-Koordinaten (dreht als Rechteck mit). */
export function anzeigeBereich(
  bereich: Bereich,
  schema: Raumschema,
  drehungen: number,
): Bereich {
  const h = zeilen(schema);
  const b = spalten(schema);
  const ecken = [
    anzeigePosition(bereich.zeile, bereich.spalte, h, b, drehungen),
    anzeigePosition(bereich.zeile + bereich.hoehe - 1, bereich.spalte + bereich.breite - 1, h, b, drehungen),
  ];
  return bereichAus(ecken[0], ecken[1]);
}

/** Alle Tischzellen in Lesereihenfolge des gespeicherten Rasters. */
export function tischzellen(schema: Raumschema): { zeile: number; spalte: number }[] {
  const plaetze: { zeile: number; spalte: number }[] = [];
  schema.zellen.forEach((zeile, z) =>
    zeile.forEach((typ, s) => {
      if (typ === 'tisch') plaetze.push({ zeile: z, spalte: s });
    }),
  );
  return plaetze;
}

/**
 * Ein rechteckiger Bereich im Raster – die Einheit, mit der der Editor
 * arbeitet: Ein „Element“ (Tischreihe, Wand, Tür) ist ein Rechteck aus Zellen
 * desselben Typs. Damit bleibt die CSV ein Raster und trotzdem lassen sich
 * Elemente wie in einer Tabellenkalkulation aufziehen.
 */
export interface Bereich {
  zeile: number;
  spalte: number;
  hoehe: number;
  breite: number;
}

/** Bereich aus zwei Eckpunkten (in beliebiger Reihenfolge). */
export function bereichAus(
  von: { zeile: number; spalte: number },
  bis: { zeile: number; spalte: number },
): Bereich {
  const zeile = Math.min(von.zeile, bis.zeile);
  const spalte = Math.min(von.spalte, bis.spalte);
  return {
    zeile,
    spalte,
    hoehe: Math.abs(von.zeile - bis.zeile) + 1,
    breite: Math.abs(von.spalte - bis.spalte) + 1,
  };
}

export function imBereich(bereich: Bereich, zeile: number, spalte: number): boolean {
  return (
    zeile >= bereich.zeile &&
    zeile < bereich.zeile + bereich.hoehe &&
    spalte >= bereich.spalte &&
    spalte < bereich.spalte + bereich.breite
  );
}

/** Überschneiden sich zwei Bereiche? */
export function bereicheUeberlappen(a: Bereich, b: Bereich): boolean {
  return (
    a.zeile < b.zeile + b.hoehe &&
    b.zeile < a.zeile + a.hoehe &&
    a.spalte < b.spalte + b.breite &&
    b.spalte < a.spalte + a.breite
  );
}

/** Liegt `innen` vollständig in `aussen`? */
function bereichEnthaelt(aussen: Bereich, innen: Bereich): boolean {
  return (
    innen.zeile >= aussen.zeile &&
    innen.spalte >= aussen.spalte &&
    innen.zeile + innen.hoehe <= aussen.zeile + aussen.hoehe &&
    innen.spalte + innen.breite <= aussen.spalte + aussen.breite
  );
}

/** Textfeld an einer Zelle (falls die Zelle zu einem verbundenen Feld gehört). */
export function beschriftungBei(
  schema: Raumschema,
  zeile: number,
  spalte: number,
): Beschriftung | undefined {
  return schema.beschriftungen.find((b) => imBereich(b, zeile, spalte));
}

/** Alle Textfelder, die einen Bereich berühren. */
export function beschriftungenIn(schema: Raumschema, bereich: Bereich): Beschriftung[] {
  return schema.beschriftungen.filter((b) => bereicheUeberlappen(b, bereich));
}

/**
 * Zellen verbinden: Über den Bereich kommt ein Textfeld. Bereits vorhandene
 * Textfelder darin gehen darin auf – ihre Texte werden zusammengezogen, damit
 * beim Verbinden nichts verloren geht.
 *
 * Was im Raster steht, bleibt stehen: Ein Textfeld beschriftet auch eine Tür
 * („Haupteingang“), ein Pult oder eine Tischreihe („Aufsicht“). Es liegt über
 * den Zellen, statt sie zu ersetzen – ein beschrifteter Tisch bleibt also ein
 * Sitzplatz. Frei macht eine Fläche nur der Radierer.
 */
export function verbindeZellen(schema: Raumschema, bereich: Bereich, text?: string): Raumschema {
  const bisherige = beschriftungenIn(schema, bereich);
  const zusammen =
    text ?? bisherige.map((b) => b.text.trim()).filter((wert) => wert !== '').join(' ');
  return {
    raum: schema.raum,
    zellen: schema.zellen,
    beschriftungen: [
      ...schema.beschriftungen.filter((b) => !bereicheUeberlappen(b, bereich)),
      { ...bereich, text: zusammen },
    ],
  };
}

/** Zellen trennen: Alle Textfelder im Bereich fallen weg. */
export function trenneZellen(schema: Raumschema, bereich: Bereich): Raumschema {
  return {
    raum: schema.raum,
    zellen: schema.zellen,
    beschriftungen: schema.beschriftungen.filter((b) => !bereicheUeberlappen(b, bereich)),
  };
}

/** Text eines Feldes ändern; angesprochen wird es über seine obere linke Zelle. */
export function setzeBeschriftungsText(
  schema: Raumschema,
  zeile: number,
  spalte: number,
  text: string,
): Raumschema {
  return {
    raum: schema.raum,
    zellen: schema.zellen,
    beschriftungen: schema.beschriftungen.map((b) =>
      imBereich(b, zeile, spalte) ? { ...b, text } : b,
    ),
  };
}

/**
 * Alle Zellen eines Bereichs auf einen Typ setzen. Textfelder bleiben dabei
 * liegen – sie beschriften ja gerade das, was darunter steht. Nur der
 * Radierer (`leer`) räumt auch sie weg: Wer eine Fläche frei macht, will
 * dort nichts stehen lassen.
 */
export function fuelleBereich(schema: Raumschema, bereich: Bereich, typ: ZellTyp): Raumschema {
  return {
    raum: schema.raum,
    zellen: schema.zellen.map((reihe, z) =>
      reihe.map((alt, s) => (imBereich(bereich, z, s) ? typ : alt)),
    ),
    beschriftungen: ohneBeschriftungenIm(schema.beschriftungen, typ === 'leer' ? bereich : null),
  };
}

/** Textfelder in einem Bereich entfernen (`null` lässt alle stehen). */
function ohneBeschriftungenIm(beschriftungen: Beschriftung[], bereich: Bereich | null): Beschriftung[] {
  if (!bereich) return beschriftungen;
  return beschriftungen.filter((b) => !bereicheUeberlappen(b, bereich));
}

/**
 * Bereich verschieben: Der Inhalt wandert um `dZeile`/`dSpalte`, die alten
 * Zellen werden frei. Was außerhalb des Rasters landen würde, bleibt liegen.
 */
export function verschiebeBereich(
  schema: Raumschema,
  bereich: Bereich,
  dZeile: number,
  dSpalte: number,
): Raumschema {
  if (dZeile === 0 && dSpalte === 0) return schema;
  const hoehe = zeilen(schema);
  const breite = spalten(schema);
  const passt = (z: number, s: number) => z >= 0 && z < hoehe && s >= 0 && s < breite;

  // Inhalt merken, Quelle leeren, am Ziel einsetzen.
  const inhalt: { zeile: number; spalte: number; typ: ZellTyp }[] = [];
  for (let z = bereich.zeile; z < bereich.zeile + bereich.hoehe; z++) {
    for (let s = bereich.spalte; s < bereich.spalte + bereich.breite; s++) {
      if (passt(z, s)) inhalt.push({ zeile: z + dZeile, spalte: s + dSpalte, typ: schema.zellen[z][s] });
    }
  }
  const zellen = schema.zellen.map((reihe, z) =>
    reihe.map((typ, s) => (imBereich(bereich, z, s) ? ('leer' as ZellTyp) : typ)),
  );
  for (const zelle of inhalt) {
    if (passt(zelle.zeile, zelle.spalte)) zellen[zelle.zeile][zelle.spalte] = zelle.typ;
  }

  // Textfelder im verschobenen Block wandern mit; angeschnittene fallen weg.
  const beschriftungen: Beschriftung[] = [];
  for (const b of schema.beschriftungen) {
    if (!bereicheUeberlappen(b, bereich)) {
      beschriftungen.push(b);
      continue;
    }
    if (!bereichEnthaelt(bereich, b)) continue;
    const ziel = { ...b, zeile: b.zeile + dZeile, spalte: b.spalte + dSpalte };
    if (passt(ziel.zeile, ziel.spalte) && passt(ziel.zeile + ziel.hoehe - 1, ziel.spalte + ziel.breite - 1)) {
      beschriftungen.push(ziel);
    }
  }
  return { raum: schema.raum, zellen, beschriftungen };
}

/**
 * Bereich aufziehen oder verkleinern (Ziehen an der unteren Ecke): Der neue
 * Bereich wird mit `typ` gefüllt, weggefallene Zellen werden frei.
 */
export function bereichAendern(
  schema: Raumschema,
  alt: Bereich,
  neu: Bereich,
  typ: ZellTyp,
): Raumschema {
  const geleert: Raumschema = {
    raum: schema.raum,
    zellen: schema.zellen.map((reihe, z) =>
      reihe.map((zellTyp, s) => (imBereich(alt, z, s) && !imBereich(neu, z, s) ? 'leer' : zellTyp)),
    ),
    // Wie beim Füllen: Nur der Radierer nimmt die Textfelder mit.
    beschriftungen: ohneBeschriftungenIm(schema.beschriftungen, typ === 'leer' ? alt : null),
  };
  return fuelleBereich(geleert, neu, typ);
}

/** Zelltyp setzen (unveränderlich, gibt ein neues Schema zurück). */
export function setzeZelle(schema: Raumschema, zeile: number, spalte: number, typ: ZellTyp): Raumschema {
  return fuelleBereich(schema, { zeile, spalte, hoehe: 1, breite: 1 }, typ);
}

/** Nächster Zelltyp beim Antippen im Bearbeiten-Modus. */
export const ZELL_REIHENFOLGE: ZellTyp[] = ['leer', 'tisch', 'tuer', 'wand', 'pult'];

export function naechsterZellTyp(typ: ZellTyp): ZellTyp {
  const index = ZELL_REIHENFOLGE.indexOf(typ);
  return ZELL_REIHENFOLGE[(index + 1) % ZELL_REIHENFOLGE.length];
}

/** Zeile/Spalte anhängen oder entfernen (für den Editor). */
export function mitGroesse(schema: Raumschema, anzahlZeilen: number, anzahlSpalten: number): Raumschema {
  const z = Math.max(1, anzahlZeilen);
  const s = Math.max(1, anzahlSpalten);
  return {
    raum: schema.raum,
    zellen: Array.from({ length: z }, (_, zi) =>
      Array.from({ length: s }, (_, si): ZellTyp => schema.zellen[zi]?.[si] ?? 'leer'),
    ),
    beschriftungen: beschnitteneBeschriftungen(schema.beschriftungen, z, s),
  };
}
