/**
 * Portierung von `4_MailRaumZuordnung/2_raum_zuteilung_erstellen/createRoomAssignment.py`:
 * Studierende auf Räume verteilen, Sitzplatznummern und eindeutige
 * Namenspräfixe (für den Aushang) vergeben.
 */
import { parseCsvObjects, toCsv } from './csv';
import { normalizeName } from './namen';
import { Raumschema, tischzellen } from './raumschema';
import { Raum, Sitzplatz, Zulassung } from './types';

export type Verteilmodus = 'balanced' | 'sequential';

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
 * Nebenprodukt von `erstelleRaumzuteilung` – die Antwort „für 12 Leute fehlen
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

export interface RaumzuteilungsOptionen {
  modus: Verteilmodus;
  /**
   * Plätze je Raum, aus den Rastern (`plaetzeJeRaum`). Ein Raum ohne Raster
   * hat keine Plätze – wer dort landen würde, steht hinterher in `ohnePlatz`.
   */
  plaetze: Map<string, number>;
  /** Erste vergebene Sitzplatznummer (Default 1001). */
  ersteSitzplatznummer?: number;
  /**
   * Wer schon fest auf einem Platz sitzt: Matrikelnummer → Schlüssel des
   * Raumeinsatzes (`raumSchluessel`). Diese Personen kommen in ihren Raum,
   * bevor verteilt wird – sonst landete jemand, den man vorher von Hand
   * gesetzt hat, beim nächsten Verteilen woanders.
   */
  vorgaben?: Map<string, string>;
}

export interface Raumzuteilung {
  sitzplaetze: Sitzplatz[];
  /** Personen, für die kein Platz mehr frei war. */
  ohnePlatz: Zulassung[];
}

/**
 * Teilnehmende auf Räume verteilen.
 * `balanced` füllt nach geringster relativer Auslastung, `sequential` Raum für Raum.
 * Sitzplatznummern werden anschließend je Raum/Zeit alphabetisch vergeben.
 */
export function erstelleRaumzuteilung(
  teilnehmer: Zulassung[],
  raeume: Raum[],
  optionen: RaumzuteilungsOptionen,
): Raumzuteilung {
  const belegung = raeume.map((raum) => ({
    raum,
    belegt: 0,
    plaetze: plaetzeDesRaums(raum, optionen.plaetze),
  }));
  const zuteilung: { person: Zulassung; raum: Raum }[] = [];
  const ohnePlatz: Zulassung[] = [];
  let raumIndex = 0;

  // Erst die Vorgaben: Wer im Sitzplan festgesetzt wurde, bleibt in seinem
  // Raum – der Platz dort ist belegt, bevor der Rest verteilt wird.
  const vorgaben = optionen.vorgaben ?? new Map<string, string>();
  const festgesetzt = new Set<string>();
  for (const person of teilnehmer) {
    const schluessel = vorgaben.get(person.matrikelnummer);
    if (schluessel === undefined) continue;
    const ziel = belegung.find((eintrag) => raumSchluessel(eintrag.raum) === schluessel);
    if (!ziel) continue;
    ziel.belegt++;
    zuteilung.push({ person, raum: ziel.raum });
    festgesetzt.add(person.matrikelnummer);
  }

  for (const person of teilnehmer) {
    if (festgesetzt.has(person.matrikelnummer)) continue;
    let ziel: { raum: Raum; belegt: number; plaetze: number } | undefined;
    if (optionen.modus === 'balanced') {
      ziel = [...belegung]
        .filter((b) => b.belegt < b.plaetze)
        .sort((a, b) => a.belegt / a.plaetze - b.belegt / b.plaetze)[0];
    } else {
      while (raumIndex < belegung.length && belegung[raumIndex].belegt >= belegung[raumIndex].plaetze) {
        raumIndex++;
      }
      ziel = belegung[raumIndex];
    }
    if (!ziel) {
      ohnePlatz.push(person);
      continue;
    }
    ziel.belegt++;
    zuteilung.push({ person, raum: ziel.raum });
  }

  // Sitzplatznummern: sortiert nach Zeit+Raum, dann Nachname (normalisiert).
  // Sortiert wird über den Schlüssel des Einsatzes: Zwei Durchgänge desselben
  // Raums sind zwei Gruppen, auch wenn der Name derselbe ist.
  zuteilung.sort((a, b) => {
    const zeitRaumA = `${a.raum.reservierteZeit} - ${raumSchluessel(a.raum)}`;
    const zeitRaumB = `${b.raum.reservierteZeit} - ${raumSchluessel(b.raum)}`;
    if (zeitRaumA !== zeitRaumB) return zeitRaumA.localeCompare(zeitRaumB);
    return normalizeName(a.person.nachname).localeCompare(normalizeName(b.person.nachname));
  });

  const start = optionen.ersteSitzplatznummer ?? 1001;
  const praefixe = eindeutigeNamenspraefixe(zuteilung.map(({ person }) => person));

  const sitzplaetze = zuteilung.map(({ person, raum }, i) => ({
    anfangNachname: praefixe.get(person) ?? person.nachname,
    sitzplatznummer: start + i,
    raum: raum.raum,
    raumSchluessel: raumSchluessel(raum),
    reservierteZeit: raum.reservierteZeit,
    matrikelnummer: person.matrikelnummer,
    anwesend: '',
    nachname: person.nachname,
    vorname: person.vorname,
    zeitUndRaum: `${raum.reservierteZeit} - ${raum.raum}`,
    email: person.email,
  }));

  return { sitzplaetze, ohnePlatz };
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
