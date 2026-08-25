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
 * dessen Raster. So stehen alle Räume in einer Datei.
 */
import { parseCsvRows, toCsv } from './csv';

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

export interface Raumschema {
  raum: string;
  /** Raster [Zeile][Spalte] in kanonischer Ausrichtung (wie gespeichert). */
  zellen: ZellTyp[][];
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
      aktuell = { raum: (row[1] ?? '').trim(), zellen: [] };
      schemata.push(aktuell);
      continue;
    }
    if (aktuell === null) {
      // Raster ohne vorangestellte Raum-Zeile: namenloser Raum.
      aktuell = { raum: '', zellen: [] };
      schemata.push(aktuell);
    }
    aktuell.zellen.push(row.map((zelle) => KUERZEL_ZU_TYP[zelle.trim().toUpperCase()] ?? 'leer'));
  }

  return schemata.map(rechteckig);
}

/** Kurze Zeilen mit `leer` auffüllen, damit das Raster rechteckig ist. */
function rechteckig(schema: Raumschema): Raumschema {
  const breite = spalten(schema);
  return {
    raum: schema.raum,
    zellen: schema.zellen.map((zeile) => {
      const voll = [...zeile];
      while (voll.length < breite) voll.push('leer');
      return voll;
    }),
  };
}

export function raumschemataToCsv(schemata: Raumschema[]): string {
  const rows: string[][] = [];
  for (const schema of schemata) {
    rows.push(['Raum', schema.raum]);
    for (const zeile of schema.zellen) {
      rows.push(zeile.map((typ) => ZELL_KUERZEL[typ]));
    }
  }
  return toCsv(rows);
}

/** Leeres Raster einer bestimmten Größe. */
export function leeresRaumschema(raum: string, anzahlZeilen: number, anzahlSpalten: number): Raumschema {
  return {
    raum,
    zellen: Array.from({ length: anzahlZeilen }, () =>
      Array.from({ length: anzahlSpalten }, (): ZellTyp => 'leer'),
    ),
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
  return { raum, zellen };
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

/** Zelltyp setzen (unveränderlich, gibt ein neues Schema zurück). */
export function setzeZelle(schema: Raumschema, zeile: number, spalte: number, typ: ZellTyp): Raumschema {
  return {
    raum: schema.raum,
    zellen: schema.zellen.map((reihe, z) =>
      z === zeile ? reihe.map((alt, s) => (s === spalte ? typ : alt)) : reihe,
    ),
  };
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
  };
}
