/**
 * Die Räume einer Klausur: welche es sind, wie viele Plätze sie haben und ob
 * sie reichen.
 *
 * **Wer wo sitzt, steht hier nicht** – das rechnet `planeSitzplan`
 * (`sitzplanung.ts`) aus den Rastern: erst die Plätze wählen, dann die
 * Personen zuordnen. Hier bleibt, was für alle Schritte davor gilt – die
 * Raumliste, die Platzzahl aus dem Raster, die Platzfrage und das CSV-Format
 * des Sitzplans (Portierung von
 * `4_MailRaumZuordnung/2_raum_zuteilung_erstellen/createRoomAssignment.py`).
 */
import { parseCsvObjects, toCsv } from './csv';
import { normalizeName } from './namen';
import { Raumschema, tischzellen } from './raumschema';
import { Raum, Sitzplatz, Zulassung } from './types';

/**
 * Raumliste einer Klausur (`Raum;ReservierteZeit`) einlesen.
 *
 * Ein Raum darf mehrfach vorkommen – dann wird er in dieser Klausur mehrfach
 * benutzt (Gruppe 1 vormittags, Gruppe 2 nachmittags). Der wievielte Einsatz
 * das ist, steht nicht in der Datei, sondern ergibt sich aus der Reihenfolge:
 * Die Zeilen werden beim Einlesen durchgezählt.
 *
 * Eine ältere Datei mit einer Spalte `Plätze` bleibt lesbar – die Spalte wird
 * **überlesen**: Wie viele Plätze ein Raum hat, sagen die Tische seines
 * Rasters (`plaetzeJeRaum`), nicht eine Zahl in einer Liste daneben.
 */
export function parseRaeume(csvText: string): Raum[] {
  const bisher = new Map<string, number>();
  return parseCsvObjects(csvText).map((row) => {
    const raum = row['Raum'] ?? '';
    const durchgang = (bisher.get(raum) ?? 0) + 1;
    bisher.set(raum, durchgang);
    return {
      raum,
      reservierteZeit: row['ReservierteZeit'] ?? '',
      durchgang,
    };
  });
}

/**
 * Wie viele Plätze jeder Raum hat: die Tische seines Rasters.
 *
 * Das ist die **einzige** Quelle der Platzzahl. Sie wird nirgends gespeichert
 * – ein Raum ist sein Raster, und wer darin einen Tisch setzt oder entfernt,
 * ändert damit auch die Zahl der Plätze. Eine zweite, mitgeschriebene Zahl
 * wäre nach dem ersten Umbau falsch.
 */
export function plaetzeJeRaum(schemata: Raumschema[]): Map<string, number> {
  return new Map(schemata.map((schema) => [schema.raum, tischzellen(schema).length]));
}

/** Plätze eines Raums – 0, solange es zu ihm kein Raster gibt. */
export function plaetzeDesRaums(raum: Pick<Raum, 'raum'>, plaetze: Map<string, number>): number {
  return plaetze.get(raum.raum) ?? 0;
}

/**
 * Wie viele Plätze eine Klausur zusammen hat: die Summe über alle
 * Raum**einsätze**. Derselbe Raum zweimal heißt zweimal seine Plätze – die
 * beiden Durchgänge sitzen nacheinander darin.
 */
export function plaetzeGesamt(raeume: Raum[], plaetze: Map<string, number>): number {
  return raeume.reduce((summe, raum) => summe + plaetzeDesRaums(raum, plaetze), 0);
}

/**
 * Reichen die Räume für die Teilnehmenden?
 *
 * Die Frage steht vor jeder Zuteilung: Erst wenn genug Plätze da sind, lohnt
 * sich das Verteilen. Deshalb ist sie eine eigene Auskunft und nicht bloß ein
 * Nebenprodukt des Verteilens – die Antwort „für 12 Leute fehlen
 * 4 Plätze“ kommt sonst erst, wenn schon verteilt wurde.
 */
export interface Platzbedarf {
  /** Wie viele Personen einen Platz brauchen. */
  teilnehmende: number;
  /** Die maximale Zahl der Plätze in allen Raumeinsätzen zusammen. */
  plaetze: number;
  /** Plätze, die nach der Zuteilung frei blieben (0, wenn es zu wenige sind). */
  frei: number;
  /** Plätze, die fehlen (0, wenn es reicht). */
  fehlende: number;
  /** Räume der Liste, zu denen es (noch) kein Raster gibt – sie haben 0 Plätze. */
  ohneRaster: string[];
  reicht: boolean;
}

export function pruefePlatzbedarf(
  teilnehmende: number,
  raeume: Raum[],
  plaetze: Map<string, number>,
): Platzbedarf {
  const gesamt = plaetzeGesamt(raeume, plaetze);
  const ohneRaster = [
    ...new Set(
      raeume.filter((raum) => raum.raum !== '' && !plaetze.has(raum.raum)).map((raum) => raum.raum),
    ),
  ];
  return {
    teilnehmende,
    plaetze: gesamt,
    frei: Math.max(0, gesamt - teilnehmende),
    fehlende: Math.max(0, teilnehmende - gesamt),
    ohneRaster,
    reicht: gesamt >= teilnehmende,
  };
}

/**
 * Schlüssel eines Raumeinsatzes: `01/E01` für den ersten, `01/E01 (2. Durchgang)`
 * für den zweiten. Belegung, Sitzplatznummern und Sitzplan hängen daran –
 * der Raumname allein wäre bei zwei Durchgängen zweimal derselbe.
 */
export function raumSchluessel(raum: Pick<Raum, 'raum' | 'durchgang'>): string {
  const durchgang = raum.durchgang ?? 1;
  return durchgang > 1 ? `${raum.raum} (${durchgang}. Durchgang)` : raum.raum;
}

/**
 * Wievielter Einsatz jedes Raums – für Listen, die von Hand zusammengestellt
 * werden (im Screen kann derselbe Raum mehrfach angeklickt werden).
 */
export function mitDurchgaengen(raeume: Omit<Raum, 'durchgang'>[]): Raum[] {
  const bisher = new Map<string, number>();
  return raeume.map((raum) => {
    const durchgang = (bisher.get(raum.raum) ?? 0) + 1;
    bisher.set(raum.raum, durchgang);
    return { ...raum, durchgang };
  });
}

/**
 * Die Räume einer Klausur als CSV (`Raum;ReservierteZeit`). Ohne Platzzahl:
 * Die steht im Raster des Raums (siehe `plaetzeJeRaum`).
 */
export function raeumeToCsv(raeume: Raum[]): string {
  return toCsv([
    ['Raum', 'ReservierteZeit'],
    ...raeume.map((r) => [r.raum, r.reservierteZeit]),
  ]);
}

/**
 * Kürzestes Präfix von `Nachname_Vorname`, das die Person eindeutig macht
 * (für den anonymen Aushang am Raum).
 */
export function eindeutigeNamenspraefixe(personen: Zulassung[]): Map<Zulassung, string> {
  const vollnamen = personen.map((p) => `${p.nachname}_${p.vorname}`);
  const result = new Map<Zulassung, string>();
  personen.forEach((person, index) => {
    const eigener = normalizeName(vollnamen[index]);
    let praefix = eigener;
    for (let len = 1; len <= eigener.length; len++) {
      praefix = eigener.slice(0, len);
      const kollision = vollnamen.some(
        (anderer, i) => i !== index && normalizeName(anderer).startsWith(praefix),
      );
      if (!kollision) break;
    }
    result.set(person, praefix);
  });
  return result;
}

const SITZPLAN_HEADER = [
  'Anfang_Nachname', 'Sitzplatznummer', 'Raum', 'ReservierteZeit', 'Matrikelnummer',
  'Anwesend', 'Nachname', 'Vorname', 'Zeit_und_Raum', 'Email',
];

/** Zuteilung als CSV im Format von `studierendeZuRaumUndZeitZuordnung.csv`. */
export function sitzplaetzeToCsv(sitzplaetze: Sitzplatz[]): string {
  return toCsv([
    SITZPLAN_HEADER,
    ...sitzplaetze.map((s) => [
      s.anfangNachname, s.sitzplatznummer, s.raum, s.reservierteZeit, s.matrikelnummer,
      s.anwesend, s.nachname, s.vorname, s.zeitUndRaum, s.email,
    ]),
  ]);
}

/** `studierendeZuRaumUndZeitZuordnung.csv` wieder einlesen. */
export function parseSitzplaetze(csvText: string): Sitzplatz[] {
  return parseCsvObjects(csvText).map((row) => ({
    anfangNachname: row['Anfang_Nachname'] ?? '',
    sitzplatznummer: Number(row['Sitzplatznummer'] ?? 0),
    raum: row['Raum'] ?? '',
    // Welcher Durchgang das war, steht nicht in der Datei: Wer sie einliest,
    // ordnet sie über Raum und Zeit wieder einem Einsatz zu.
    raumSchluessel: row['Raum'] ?? '',
    reservierteZeit: row['ReservierteZeit'] ?? '',
    matrikelnummer: row['Matrikelnummer'] ?? '',
    anwesend: row['Anwesend'] ?? '',
    nachname: row['Nachname'] ?? '',
    vorname: row['Vorname'] ?? '',
    zeitUndRaum: row['Zeit_und_Raum'] ?? '',
    email: row['Email'] ?? '',
  }));
}
