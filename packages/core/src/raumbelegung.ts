/**
 * Belegung eines Raumschemas: Wer sitzt an welchem Tisch?
 *
 * Die Zuteilung aus `erstelleRaumzuteilung` sagt, **wer in welchen Raum**
 * kommt. Hier kommt dazu, **wo genau** im Raum jemand sitzt:
 *
 * - Reserveplätze (`reserviert`) bleiben frei.
 * - Wer schon auf einem Tisch sitzt, bleibt dort – auch wenn der Raum
 *   umgebaut wird. Nur wer keinen Platz (mehr) hat, wird neu gesetzt.
 * - Vorgaben (`vorgabe`) halten eine Person zusätzlich auch dann auf ihrem
 *   Platz, wenn komplett neu verteilt wird (`ohneFreieBelegung`).
 * - Alle übrigen Personen füllen die freien Tische in Lesereihenfolge.
 *
 * Die Sitzplatznummer gehört zum **Tisch**, nicht zur Person: Sie steht am
 * Platz und wird in Lesereihenfolge des gespeicherten Rasters vergeben (über
 * alle Räume fortlaufend). Wer den Platz wechselt, bekommt die Nummer des
 * neuen Tisches.
 */
import { parseCsvObjects, toCsv } from './csv';
import { Bereich, imBereich, Raumschema, tischzellen } from './raumschema';
import { raumSchluessel } from './raumzuteilung';
import { Raum, Sitzplatz } from './types';

/**
 * Was in den Kästen eines Sitzplans steht – auf dem Bildschirm und im PDF
 * dasselbe, damit das Papier zeigt, was man vorher gesehen hat.
 *
 * Die Voreinstellung ist die des Aushangs: Kürzel und Platznummer, sonst
 * nichts. Die Matrikelnummer gehört nicht an eine Saaltür, und „Pult“ steht in
 * einem halbhohen Kästchen ohnehin meist im Weg.
 */
export interface PlanAnzeige {
  /** „Pult“ an den Pult-Zellen anschreiben. */
  pultText: boolean;
  /** Nachname, so weit gekürzt, dass er eindeutig ist (`anfangNachname`). */
  namensPraefix: boolean;
  matrikelnummer: boolean;
  sitzplatznummer: boolean;
}

export const PLAN_ANZEIGE_STANDARD: PlanAnzeige = {
  pultText: false,
  namensPraefix: true,
  matrikelnummer: false,
  sitzplatznummer: true,
};

export interface Platzbelegung {
  /**
   * Schlüssel des Raumeinsatzes (`raumSchluessel`), nicht bloß der Raumname:
   * Wird derselbe Raum zweimal geprüft, hat jeder Durchgang seine eigene
   * Belegung.
   */
  raum: string;
  zeile: number;
  spalte: number;
  /** Leerer String = niemand. */
  matrikelnummer: string;
  /** Reserveplatz: bleibt beim Verteilen frei. */
  reserviert: boolean;
  /** Feste Vorgabe: Person bleibt beim Verteilen auf diesem Platz. */
  vorgabe: boolean;
}

/**
 * Zu jedem Raumeinsatz sein Raster. Zwei Durchgänge desselben Raums teilen
 * sich das Raster – es ist ja derselbe Raum –, laufen hier aber unter ihrem
 * eigenen Schlüssel: Belegung und Sitzplatznummern gehören je Durchgang.
 * Räume ohne Raster fallen weg.
 */
export function einsatzRaster(raeume: Raum[], schemata: Raumschema[]): Raumschema[] {
  const raster: Raumschema[] = [];
  for (const raum of raeume) {
    const schema = schemata.find((s) => s.raum === raum.raum);
    if (schema) raster.push({ ...schema, raum: raumSchluessel(raum) });
  }
  return raster;
}

/** Schlüssel eines Platzes (Raumeinsatz + Rasterposition). */
export function platzSchluessel(raum: string, zeile: number, spalte: number): string {
  return `${raum}|${zeile}|${spalte}`;
}

/**
 * Sitzplatznummern der Tische: über alle Räume fortlaufend, je Raum in
 * Lesereihenfolge des Rasters. Reserveplätze bekommen ebenfalls eine Nummer –
 * der Tisch steht ja im Raum.
 */
export function sitzplatznummern(schemata: Raumschema[], ersteNummer: number): Map<string, number> {
  const nummern = new Map<string, number>();
  let naechste = ersteNummer;
  for (const schema of schemata) {
    for (const zelle of tischzellen(schema)) {
      nummern.set(platzSchluessel(schema.raum, zelle.zeile, zelle.spalte), naechste++);
    }
  }
  return nummern;
}

/**
 * Wie die freien Tische eines Raums vergeben werden:
 *
 * - `lesereihenfolge` – von vorne links nach hinten rechts, wie im Raster,
 * - `abstand` – so weit auseinander wie möglich (siehe `plaetzeMitAbstand`).
 */
export type Sitzverteilung = 'lesereihenfolge' | 'abstand';

/**
 * Ein Platz Abstand zur Seite zählt so viel wie zwei nach hinten: Beim
 * Abgucken ist der Nachbar neben einem das Problem – dessen Blatt liegt offen
 * in Blickrichtung.
 */
const SPALTEN_GEWICHT = 2;

/**
 * Zuschlag, wenn zwei genau hintereinander sitzen (dieselbe Spalte): Man sieht
 * dem Vordermann in den Rücken, sein Blatt liegt verdeckt vor ihm. Deshalb ist
 * „einer hinter dem anderen“ sicherer als „schräg dahinter“, obwohl schräg
 * rechnerisch weiter weg ist.
 */
const RUECKEN_BONUS = 3;

interface Platz {
  zeile: number;
  spalte: number;
}

/**
 * Gewichteter Abstand zweier Plätze – groß heißt „sicher“:
 *
 *     nebeneinander (1 Platz)      2
 *     schräg dahinter (1/1)        3
 *     direkt dahinter (1 Reihe)    4   ← lieber so als schräg
 *     zwei Plätze zur Seite        4
 */
function abstand(a: Platz, b: Platz): number {
  const seitlich = Math.abs(a.spalte - b.spalte);
  const hintereinander = Math.abs(a.zeile - b.zeile);
  return (
    SPALTEN_GEWICHT * seitlich + hintereinander + (seitlich === 0 ? RUECKEN_BONUS : 0)
  );
}

/**
 * `anzahl` Plätze so wählen, dass sie möglichst weit auseinander liegen.
 *
 * Gierig: Jeder neue Platz ist der, dessen kleinster Abstand zu allen schon
 * vergebenen am größten ist – so wird der Raum von den Rändern her gefüllt und
 * nicht erst eine Ecke. Bei Gleichstand entscheidet die Lesereihenfolge, damit
 * dieselbe Eingabe immer dieselbe Verteilung ergibt.
 */
export function plaetzeMitAbstand(frei: Platz[], vergeben: Platz[], anzahl: number): Platz[] {
  const gewaehlt: Platz[] = [];
  const offen = [...frei];
  // Abstand jedes freien Platzes zum nächsten schon vergebenen; wächst ein
  // Platz dazu, wird nur noch gegen diesen einen nachgerechnet.
  const naechster = offen.map((platz) =>
    vergeben.reduce((min, anderer) => Math.min(min, abstand(platz, anderer)), Infinity),
  );

  while (gewaehlt.length < anzahl && offen.length > 0) {
    let bester = 0;
    for (let i = 1; i < offen.length; i++) {
      if (naechster[i] > naechster[bester]) bester = i;
    }
    const platz = offen[bester];
    gewaehlt.push(platz);
    offen.splice(bester, 1);
    naechster.splice(bester, 1);
    for (let i = 0; i < offen.length; i++) {
      naechster[i] = Math.min(naechster[i], abstand(offen[i], platz));
    }
  }
  return gewaehlt;
}

/**
 * Belegung eines Raums aufbauen. Bestehende Plätze bleiben erhalten, solange
 * der Tisch noch existiert und die Person noch in den Raum gehört; alle
 * übrigen Personen bekommen die freien Tische – in Lesereihenfolge oder mit
 * größtmöglichem Abstand.
 *
 * Für eine Verteilung von vorne die bestehende Belegung vorher durch
 * `ohneFreieBelegung` schicken – dann bleiben nur Reserven und Vorgaben.
 */
export function verteileImRaum(
  schema: Raumschema,
  matrikelnummern: string[],
  bestehend: Platzbelegung[],
  verteilung: Sitzverteilung = 'lesereihenfolge',
): { belegung: Platzbelegung[]; ohnePlatz: string[] } {
  const bestehendNachPlatz = new Map(
    bestehend
      .filter((b) => b.raum === schema.raum)
      .map((b) => [platzSchluessel(b.raum, b.zeile, b.spalte), b]),
  );

  const offen = new Set(matrikelnummern);
  const belegung: Platzbelegung[] = [];

  // 1. Durchgang: Reserven und bereits gesetzte Personen übernehmen.
  for (const zelle of tischzellen(schema)) {
    const alt = bestehendNachPlatz.get(platzSchluessel(schema.raum, zelle.zeile, zelle.spalte));
    const reserviert = alt?.reserviert ?? false;
    // Eine Vorgabe bleibt, auch wenn die Person (noch) nicht zu diesem Raum
    // gehört: „fest“ heißt fest – die Zuteilung zieht sie später hierher.
    const bleibt =
      !reserviert && !!alt?.matrikelnummer && (alt.vorgabe || offen.has(alt.matrikelnummer));
    if (bleibt && alt) offen.delete(alt.matrikelnummer);
    belegung.push({
      raum: schema.raum,
      zeile: zelle.zeile,
      spalte: zelle.spalte,
      matrikelnummer: bleibt && alt ? alt.matrikelnummer : '',
      reserviert,
      vorgabe: bleibt ? (alt?.vorgabe ?? false) : false,
    });
  }

  // 2. Durchgang: restliche Personen auf die freien Tische verteilen.
  const uebrig = matrikelnummern.filter((nummer) => offen.has(nummer));
  const freieTische = belegung.filter((platz) => !platz.reserviert && platz.matrikelnummer === '');
  const ziele =
    verteilung === 'abstand'
      ? plaetzeMitAbstand(
          freieTische,
          // Reserven zählen mit: Dort sitzt zwar niemand, aber der Platz ist
          // weg – der Abstand soll sich an den wirklich Sitzenden ausrichten.
          belegung.filter((platz) => platz.matrikelnummer !== ''),
          uebrig.length,
        ).map((platz) => belegung.find((b) => b.zeile === platz.zeile && b.spalte === platz.spalte)!)
      : freieTische;

  let index = 0;
  for (const platz of ziele) {
    if (index >= uebrig.length) break;
    platz.matrikelnummer = uebrig[index++];
  }

  return { belegung, ohnePlatz: uebrig.slice(index) };
}

/**
 * Alle Räume verteilen. `sitzplaetze` stammt aus `erstelleRaumzuteilung` und
 * legt fest, wer in welchen Raumeinsatz kommt; das Schema legt fest, wo.
 * Die Raster kommen aus `einsatzRaster` und tragen deshalb den Schlüssel des
 * Einsatzes als Namen – zwei Durchgänge desselben Raums sind zwei Raster.
 */
export function verteileAufRaumschemata(
  sitzplaetze: Sitzplatz[],
  schemata: Raumschema[],
  bestehend: Platzbelegung[] = [],
  verteilung: Sitzverteilung = 'lesereihenfolge',
): { belegung: Platzbelegung[]; ohnePlatz: Sitzplatz[] } {
  const belegung: Platzbelegung[] = [];
  const ohnePlatz: Sitzplatz[] = [];

  for (const schema of schemata) {
    const imRaum = sitzplaetze.filter((platz) => platz.raumSchluessel === schema.raum);
    const ergebnis = verteileImRaum(
      schema,
      imRaum.map((p) => p.matrikelnummer),
      bestehend,
      verteilung,
    );
    belegung.push(...ergebnis.belegung);
    for (const nummer of ergebnis.ohnePlatz) {
      const person = imRaum.find((p) => p.matrikelnummer === nummer);
      if (person) ohnePlatz.push(person);
    }
  }

  // Personen in Räumen ohne Schema gelten als nicht platziert.
  const bekannteRaeume = new Set(schemata.map((s) => s.raum));
  for (const platz of sitzplaetze) {
    if (!bekannteRaeume.has(platz.raumSchluessel)) ohnePlatz.push(platz);
  }

  return { belegung, ohnePlatz };
}

/**
 * Belegung mitverschieben, wenn im Editor ein Block bewegt wird – sonst
 * verlören die Personen beim Verschieben eines Tisches ihren Platz.
 */
export function verschiebeBelegung(
  belegung: Platzbelegung[],
  raum: string,
  bereich: Bereich,
  dZeile: number,
  dSpalte: number,
): Platzbelegung[] {
  const bewegt = (platz: Platzbelegung) =>
    platz.raum === raum && imBereich(bereich, platz.zeile, platz.spalte);
  const verschoben = belegung.map((platz) =>
    bewegt(platz)
      ? { ...platz, zeile: platz.zeile + dZeile, spalte: platz.spalte + dSpalte }
      : platz,
  );
  // Wer auf einen Tisch geschoben wird, der schon einen Eintrag hatte,
  // überschreibt ihn: Sonst lägen zwei Einträge auf demselben Platz und es
  // entschiede der Zufall der Reihenfolge, welcher gilt.
  const ziele = new Set(
    verschoben
      .filter((_, i) => bewegt(belegung[i]))
      .map((platz) => platzSchluessel(platz.raum, platz.zeile, platz.spalte)),
  );
  return verschoben.filter(
    (platz, i) =>
      bewegt(belegung[i]) || !ziele.has(platzSchluessel(platz.raum, platz.zeile, platz.spalte)),
  );
}

/**
 * Belegung auf Reserven und Vorgaben eindampfen – Grundlage für eine
 * Verteilung von vorne, bei der nur feste Plätze erhalten bleiben.
 */
export function ohneFreieBelegung(belegung: Platzbelegung[]): Platzbelegung[] {
  return belegung.map((platz) =>
    platz.vorgabe ? platz : { ...platz, matrikelnummer: '', vorgabe: false },
  );
}

/**
 * Person auf einen Platz setzen. Sitzt dort schon jemand, tauschen die beiden
 * die Plätze – so lässt sich im Sitzplan frei umsetzen.
 */
export function setzePerson(
  belegung: Platzbelegung[],
  raum: string,
  zeile: number,
  spalte: number,
  matrikelnummer: string,
): Platzbelegung[] {
  const ziel = belegung.find((b) => b.raum === raum && b.zeile === zeile && b.spalte === spalte);
  if (!ziel || ziel.reserviert) return belegung;
  const quelle = belegung.find((b) => b.matrikelnummer === matrikelnummer && b !== ziel);
  const getauscht = ziel.matrikelnummer;

  return belegung.map((platz) => {
    if (platz === ziel) return { ...platz, matrikelnummer };
    if (quelle && platz === quelle) return { ...platz, matrikelnummer: getauscht };
    return platz;
  });
}

/** Person von ihrem Platz nehmen (Platz wird frei). */
export function entfernePerson(belegung: Platzbelegung[], matrikelnummer: string): Platzbelegung[] {
  return belegung.map((platz) =>
    platz.matrikelnummer === matrikelnummer ? { ...platz, matrikelnummer: '', vorgabe: false } : platz,
  );
}

/** Reserveplatz an-/abschalten. Eine dort sitzende Person wird verdrängt. */
export function schalteReserve(belegung: Platzbelegung[], raum: string, zeile: number, spalte: number): Platzbelegung[] {
  return belegung.map((platz) =>
    platz.raum === raum && platz.zeile === zeile && platz.spalte === spalte
      ? { ...platz, reserviert: !platz.reserviert, matrikelnummer: platz.reserviert ? platz.matrikelnummer : '', vorgabe: false }
      : platz,
  );
}

/** Vorgabe setzen oder lösen (nur sinnvoll, wenn dort jemand sitzt). */
export function setzeVorgabe(
  belegung: Platzbelegung[],
  raum: string,
  zeile: number,
  spalte: number,
  fest: boolean,
): Platzbelegung[] {
  return belegung.map((platz) =>
    platz.raum === raum && platz.zeile === zeile && platz.spalte === spalte && platz.matrikelnummer !== ''
      ? { ...platz, vorgabe: fest }
      : platz,
  );
}

/** Vorgabe an-/abschalten (nur sinnvoll, wenn dort jemand sitzt). */
export function schalteVorgabe(belegung: Platzbelegung[], raum: string, zeile: number, spalte: number): Platzbelegung[] {
  const platz = belegung.find((b) => b.raum === raum && b.zeile === zeile && b.spalte === spalte);
  return setzeVorgabe(belegung, raum, zeile, spalte, !platz?.vorgabe);
}

/**
 * Sitzplätze mit den Nummern der tatsächlich belegten Tische – Grundlage für
 * Aushang, Sitzplan-CSV und die PDFs. Personen ohne Platz im Raster behalten
 * ihre bisherige Nummer.
 */
export function sitzplaetzeMitBelegung(
  sitzplaetze: Sitzplatz[],
  belegung: Platzbelegung[],
  nummern: Map<string, number>,
): Sitzplatz[] {
  const nummerJePerson = new Map<string, number>();
  for (const platz of belegung) {
    if (platz.matrikelnummer === '') continue;
    const nummer = nummern.get(platzSchluessel(platz.raum, platz.zeile, platz.spalte));
    if (nummer !== undefined) nummerJePerson.set(platz.matrikelnummer, nummer);
  }
  return sitzplaetze
    .map((platz) => ({
      ...platz,
      sitzplatznummer: nummerJePerson.get(platz.matrikelnummer) ?? platz.sitzplatznummer,
    }))
    .sort((a, b) => a.sitzplatznummer - b.sitzplatznummer);
}

const BELEGUNG_HEADER = [
  'Raum', 'Zeile', 'Spalte', 'Sitzplatznummer', 'Matrikelnummer', 'Nachname', 'Vorname', 'Reserviert', 'Vorgabe',
];

/**
 * Belegung als CSV. `Sitzplatznummer`, `Nachname` und `Vorname` stehen nur zur
 * Lesbarkeit darin (z. B. in Excel) und werden beim Einlesen ignoriert –
 * maßgeblich sind Raum, Rasterposition, Matrikelnummer und die beiden Flags.
 */
export function belegungToCsv(
  belegung: Platzbelegung[],
  personen: Sitzplatz[],
  nummern: Map<string, number>,
): string {
  const jeMatrikel = new Map(personen.map((p) => [p.matrikelnummer, p]));
  return toCsv([
    BELEGUNG_HEADER,
    ...belegung.map((platz) => {
      const person = jeMatrikel.get(platz.matrikelnummer);
      return [
        platz.raum,
        platz.zeile,
        platz.spalte,
        nummern.get(platzSchluessel(platz.raum, platz.zeile, platz.spalte)) ?? '',
        platz.matrikelnummer,
        person?.nachname ?? '',
        person?.vorname ?? '',
        platz.reserviert ? 'ja' : '',
        platz.vorgabe ? 'ja' : '',
      ];
    }),
  ]);
}

export function parseBelegung(csvText: string): Platzbelegung[] {
  return parseCsvObjects(csvText).map((row) => ({
    raum: row['Raum'] ?? '',
    zeile: Number(row['Zeile'] ?? 0),
    spalte: Number(row['Spalte'] ?? 0),
    matrikelnummer: row['Matrikelnummer'] ?? '',
    reserviert: jaNein(row['Reserviert']),
    vorgabe: jaNein(row['Vorgabe']),
  }));
}

function jaNein(wert: string | undefined): boolean {
  const text = (wert ?? '').trim().toLowerCase();
  return text === 'ja' || text === 'x' || text === 'true' || text === '1';
}
