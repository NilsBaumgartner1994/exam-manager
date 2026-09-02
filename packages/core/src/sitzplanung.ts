/**
 * Die Verteilung in zwei Schritten: **erst die Plätze, dann die Personen.**
 *
 * Vorher lief es andersherum – eine Person wurde einem Raum zugeteilt, bekam
 * dort einen Tisch und daraus ihre Sitzplatznummer. Wer weit auseinander
 * sitzen soll, muss die Plätze aber kennen, bevor jemand darauf sitzt:
 *
 * 1. **Plätze wählen** (`waehlePlaetze`): So viele Tische, wie Personen zu
 *    setzen sind – wahlweise so weit auseinander wie möglich (jeder neue Platz
 *    ist der mit dem größten Abstand zu den schon gewählten) oder schlicht in
 *    Lesereihenfolge. Über die Räume hinweg wird dabei entweder einer nach dem
 *    anderen gefüllt oder gleichmäßig (immer der Raum, in dem prozentual am
 *    meisten frei ist).
 * 2. **Personen zuordnen** (`planeSitzplan`): Erst jetzt bekommen die
 *    gewählten Plätze ihre Leute – der Reihe nach, Raum für Raum und darin
 *    Reihe für Reihe. So laufen Namen und Sitzplatznummern sauber parallel:
 *    Wer im Alphabet vorne steht, sitzt auf der kleineren Nummer.
 *
 * Was von Hand gesetzt wurde, bleibt: Ein **freigehaltener** Platz (mit
 * Nachricht, warum) wird nicht gewählt, eine **Vorgabe** hält ihre Person auf
 * ihrem Tisch und zählt als belegt – deshalb lässt sich jemand festsetzen und
 * danach neu verteilen, ohne dass er wandert.
 */
import { normalizeName } from './namen';
import {
  einsatzRaster,
  ohneFreieBelegung,
  platzAbstand,
  platzSchluessel,
  Platzbelegung,
  Sitzverteilung,
  sitzplatznummern,
} from './raumbelegung';
import { Raumschema, tischzellen } from './raumschema';
import { eindeutigeNamenspraefixe, raumSchluessel } from './raumzuteilung';
import { Raum, Sitzplatz, Zulassung } from './types';

/**
 * Wie die Räume gefüllt werden:
 *
 * - `nacheinander` – ein Raum wird gefüllt, bis er voll ist, dann der nächste.
 *   Das ist die Vorgabe: Wer drei Räume hat und nur einen braucht, soll nicht
 *   in allen dreien Aufsicht stellen müssen.
 * - `gleichmaessig` – jeder neue Platz geht in den Raum, in dem prozentual am
 *   meisten frei ist. So füllen sich alle Räume gleich weit.
 */
export type Raumfuellung = 'nacheinander' | 'gleichmaessig';

const FUELLUNG_WOERTER: Record<string, Raumfuellung> = {
  nacheinander: 'nacheinander',
  gleichmaessig: 'gleichmaessig',
  // Die englischen Wörter der ersten Fassung bleiben gültig – Skripte, die sie
  // benutzen, sollen nicht wegen einer Umbenennung stehenbleiben.
  sequential: 'nacheinander',
  balanced: 'gleichmaessig',
};

/** Wort aus Kommandozeile oder Datei als Raumfüllung lesen – `null`, wenn unbekannt. */
export function raumfuellungAus(wort: string): Raumfuellung | null {
  return FUELLUNG_WOERTER[wort.trim().toLowerCase()] ?? null;
}

/** Die zulässigen Wörter für `--modus`, für Hilfetexte und Fehlermeldungen. */
export const RAUMFUELLUNGEN: Raumfuellung[] = ['nacheinander', 'gleichmaessig'];

export interface SitzplanOptionen {
  /**
   * Wie die Plätze **innerhalb** eines Raums gewählt werden: `abstand` (die
   * Vorgabe) sucht den jeweils entferntesten, `lesereihenfolge` nimmt sie von
   * vorne links.
   */
  sitzverteilung?: Sitzverteilung;
  /** Wie die Räume gefüllt werden. Vorgabe: `nacheinander`. */
  fuellung?: Raumfuellung;
  /** Erste vergebene Sitzplatznummer (Vorgabe 1001). */
  ersteSitzplatznummer?: number;
}

/** Ein Platz im Raster eines Raumeinsatzes. */
export interface PlatzAdresse {
  /** Schlüssel des Raumeinsatzes (`raumSchluessel`). */
  raum: string;
  zeile: number;
  spalte: number;
}

/** Was in einem Raumeinsatz nach der Planung steht – für die Vorschau. */
export interface EinsatzStand {
  /** Schlüssel des Einsatzes (`raumSchluessel`). */
  schluessel: string;
  /** Name des Raums, wie er auf dem Aushang steht. */
  raum: string;
  reservierteZeit: string;
  /** Tische im Raster. */
  plaetze: number;
  /** Tische, die für diese Klausur freigehalten werden. */
  freigehalten: number;
  /** Tische, auf denen jemand sitzt. */
  belegt: number;
}

export interface Sitzplanung {
  belegung: Platzbelegung[];
  /** Die Sitzplätze, nach Sitzplatznummer sortiert. */
  sitzplaetze: Sitzplatz[];
  /** Sitzplatznummern je Platz (`platzSchluessel`) – über alle Einsätze fortlaufend. */
  nummern: Map<string, number>;
  /** Wer keinen Platz mehr bekommen hat. */
  ohnePlatz: Zulassung[];
  /** Stand je Raumeinsatz – die Zahlen der Vorschau. */
  raeume: EinsatzStand[];
}

/** Ein Raumeinsatz, während die Plätze gewählt werden. */
interface Wahlraum {
  schluessel: string;
  /** Freie Tische in Lesereihenfolge. */
  frei: PlatzAdresse[];
  /**
   * Abstand jedes freien Tisches zum nächsten belegten. Wächst ein Platz dazu,
   * wird nur gegen diesen einen nachgerechnet – das ist die Rechnung aus
   * `plaetzeMitAbstand`, hier über alle Räume verschränkt.
   */
  naechster: number[];
  /** Nutzbare Tische: alle außer den freigehaltenen. */
  plaetze: number;
  /** Schon belegte Tische (Vorgaben und bereits gewählte). */
  belegt: number;
}

/**
 * `anzahl` Plätze auswählen – über alle Raumeinsätze hinweg.
 *
 * Gewählt wird ein Platz nach dem anderen: erst der Raum (nacheinander oder
 * gleichmäßig), dann darin der Tisch (entferntester oder nächster in
 * Lesereihenfolge). Belegte Tische aus `bestehend` (Vorgaben) zählen für den
 * Abstand mit, freigehaltene fallen weg.
 *
 * Zurück kommen die Plätze **in der Reihenfolge, in der sie gewählt wurden** –
 * wer sie in Lesereihenfolge braucht, sortiert sie selbst (`planeSitzplan`
 * tut genau das).
 */
export function waehlePlaetze(
  raster: Raumschema[],
  bestehend: Platzbelegung[],
  anzahl: number,
  optionen: SitzplanOptionen = {},
): PlatzAdresse[] {
  const mitAbstand = (optionen.sitzverteilung ?? 'abstand') === 'abstand';
  const fuellung = optionen.fuellung ?? 'nacheinander';
  const vorher = new Map(
    bestehend.map((platz) => [platzSchluessel(platz.raum, platz.zeile, platz.spalte), platz]),
  );

  const raeume: Wahlraum[] = raster.map((schema) => {
    const frei: PlatzAdresse[] = [];
    const belegt: PlatzAdresse[] = [];
    let nutzbar = 0;
    for (const zelle of tischzellen(schema)) {
      const alt = vorher.get(platzSchluessel(schema.raum, zelle.zeile, zelle.spalte));
      const platz = { raum: schema.raum, zeile: zelle.zeile, spalte: zelle.spalte };
      if (alt?.reserviert) continue;
      nutzbar++;
      if (alt?.matrikelnummer) belegt.push(platz);
      else frei.push(platz);
    }
    return {
      schluessel: schema.raum,
      frei,
      naechster: frei.map((platz) =>
        belegt.reduce((min, anderer) => Math.min(min, platzAbstand(platz, anderer)), Infinity),
      ),
      plaetze: nutzbar,
      belegt: belegt.length,
    };
  });

  const gewaehlt: PlatzAdresse[] = [];
  while (gewaehlt.length < anzahl) {
    const raum = naechsterRaum(raeume, fuellung);
    if (!raum) break;
    // Der entfernteste freie Tisch; bei Gleichstand der erste in
    // Lesereihenfolge, damit dieselbe Eingabe dieselbe Verteilung ergibt.
    let bester = 0;
    if (mitAbstand) {
      for (let i = 1; i < raum.frei.length; i++) {
        if (raum.naechster[i] > raum.naechster[bester]) bester = i;
      }
    }
    const platz = raum.frei[bester];
    gewaehlt.push(platz);
    raum.frei.splice(bester, 1);
    raum.naechster.splice(bester, 1);
    raum.belegt++;
    for (let i = 0; i < raum.frei.length; i++) {
      raum.naechster[i] = Math.min(raum.naechster[i], platzAbstand(raum.frei[i], platz));
    }
  }
  return gewaehlt;
}

/**
 * In welchen Raum der nächste Platz geht: der erste mit freiem Tisch
 * (`nacheinander`) oder der, in dem prozentual am meisten frei ist
 * (`gleichmaessig`). Bei Gleichstand gilt die Reihenfolge der Raumliste.
 */
function naechsterRaum(raeume: Wahlraum[], fuellung: Raumfuellung): Wahlraum | undefined {
  const offen = raeume.filter((raum) => raum.frei.length > 0);
  if (offen.length === 0) return undefined;
  if (fuellung === 'nacheinander') return offen[0];
  return offen.reduce((bester, raum) =>
    raum.belegt / raum.plaetze < bester.belegt / bester.plaetze ? raum : bester,
  );
}

/**
 * Die ganze Verteilung: Plätze wählen, Personen zuordnen, Sitzplätze bauen.
 *
 * `bestehend` ist die bisherige Belegung – daraus zählen nur die
 * freigehaltenen Plätze und die Vorgaben (`ohneFreieBelegung`); alles andere
 * wird neu verteilt. Die Funktion ist damit wiederholbar: Zweimal mit
 * denselben Eingaben gerufen kommt zweimal dasselbe heraus.
 */
export function planeSitzplan(
  teilnehmer: Zulassung[],
  raeume: Raum[],
  schemata: Raumschema[],
  bestehend: Platzbelegung[] = [],
  optionen: SitzplanOptionen = {},
): Sitzplanung {
  const raster = einsatzRaster(raeume, schemata);
  const ersteNummer = optionen.ersteSitzplatznummer ?? 1001;
  const nummern = sitzplatznummern(raster, ersteNummer);
  // Nur Reserven und Vorgaben sind gesetzt – der Rest wird gleich verteilt.
  const basis = ohneFreieBelegung(bestehend);
  const vorher = new Map(
    basis.map((platz) => [platzSchluessel(platz.raum, platz.zeile, platz.spalte), platz]),
  );

  // Das Gerüst: je Tisch ein Eintrag, in Lesereihenfolge des Rasters und in
  // der Reihenfolge der Raumeinsätze. Diese Reihenfolge ist zugleich die der
  // Sitzplatznummern – die Zuordnung unten läuft an ihr entlang.
  const belegung: Platzbelegung[] = [];
  for (const schema of raster) {
    for (const zelle of tischzellen(schema)) {
      const alt = vorher.get(platzSchluessel(schema.raum, zelle.zeile, zelle.spalte));
      const reserviert = alt?.reserviert ?? false;
      belegung.push({
        raum: schema.raum,
        zeile: zelle.zeile,
        spalte: zelle.spalte,
        // Eine Vorgabe bleibt liegen, auch wenn die Person gar nicht (mehr) in
        // der Teilnehmerliste steht: „fest“ heißt fest, und ein Platz, der
        // stillschweigend wieder frei wird, ist die schlechtere Überraschung.
        matrikelnummer: reserviert ? '' : (alt?.matrikelnummer ?? ''),
        reserviert,
        vorgabe: !reserviert && !!alt?.matrikelnummer,
        ...(alt?.notiz ? { notiz: alt.notiz } : {}),
      });
    }
  }

  const jePlatz = new Map(
    belegung.map((platz) => [platzSchluessel(platz.raum, platz.zeile, platz.spalte), platz]),
  );
  const festgesetzt = new Set(
    belegung.filter((platz) => platz.matrikelnummer !== '').map((platz) => platz.matrikelnummer),
  );

  // Der Reihe nach heißt: nach Nachname. Damit läuft das Alphabet mit den
  // Sitzplatznummern – wer den Aushang liest, findet sich sofort.
  const offen = [...teilnehmer]
    .filter((person) => !festgesetzt.has(person.matrikelnummer))
    .sort(nachNamen);

  const gewaehlt = waehlePlaetze(raster, belegung, offen.length, optionen);
  const gewaehltSchluessel = new Set(
    gewaehlt.map((platz) => platzSchluessel(platz.raum, platz.zeile, platz.spalte)),
  );

  // Erst jetzt kommen die Personen dazu: Die gewählten Plätze werden in
  // Lesereihenfolge durchlaufen – Raum für Raum, darin Reihe für Reihe.
  let naechste = 0;
  for (const platz of belegung) {
    if (!gewaehltSchluessel.has(platzSchluessel(platz.raum, platz.zeile, platz.spalte))) continue;
    const person = offen[naechste++];
    if (!person) break;
    platz.matrikelnummer = person.matrikelnummer;
  }
  const ohnePlatz = offen.slice(Math.min(naechste, offen.length));

  const praefixe = eindeutigeNamenspraefixe(teilnehmer);
  const jeMatrikel = new Map(teilnehmer.map((person) => [person.matrikelnummer, person]));
  const einsatzJeSchluessel = new Map(raeume.map((raum) => [raumSchluessel(raum), raum]));

  const sitzplaetze: Sitzplatz[] = [];
  for (const platz of belegung) {
    const person = jeMatrikel.get(platz.matrikelnummer);
    if (!person) continue;
    const einsatz = einsatzJeSchluessel.get(platz.raum);
    const raumName = einsatz?.raum ?? platz.raum;
    const zeit = einsatz?.reservierteZeit ?? '';
    sitzplaetze.push({
      anfangNachname: praefixe.get(person) ?? person.nachname,
      sitzplatznummer:
        nummern.get(platzSchluessel(platz.raum, platz.zeile, platz.spalte)) ?? ersteNummer,
      raum: raumName,
      raumSchluessel: platz.raum,
      reservierteZeit: zeit,
      matrikelnummer: person.matrikelnummer,
      anwesend: '',
      nachname: person.nachname,
      vorname: person.vorname,
      zeitUndRaum: `${zeit} - ${raumName}`,
      email: person.email,
    });
  }
  sitzplaetze.sort((a, b) => a.sitzplatznummer - b.sitzplatznummer);

  return {
    belegung,
    sitzplaetze,
    nummern,
    ohnePlatz,
    raeume: raster.map((schema) => {
      const imRaum = belegung.filter((platz) => platz.raum === schema.raum);
      const einsatz = einsatzJeSchluessel.get(schema.raum);
      return {
        schluessel: schema.raum,
        raum: einsatz?.raum ?? schema.raum,
        reservierteZeit: einsatz?.reservierteZeit ?? '',
        plaetze: imRaum.length,
        freigehalten: imRaum.filter((platz) => platz.reserviert).length,
        belegt: imRaum.filter((platz) => platz.matrikelnummer !== '').length,
      };
    }),
  };
}

/** Nach Nachname, dann Vorname, dann Matrikelnummer – immer dieselbe Reihenfolge. */
function nachNamen(a: Zulassung, b: Zulassung): number {
  const nachname = normalizeName(a.nachname).localeCompare(normalizeName(b.nachname));
  if (nachname !== 0) return nachname;
  const vorname = normalizeName(a.vorname).localeCompare(normalizeName(b.vorname));
  if (vorname !== 0) return vorname;
  return a.matrikelnummer.localeCompare(b.matrikelnummer);
}
