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
import { Sitzplatz } from './types';

export interface Platzbelegung {
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

/** Schlüssel eines Platzes (Raum + Rasterposition). */
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
 * Belegung eines Raums aufbauen. Bestehende Plätze bleiben erhalten, solange
 * der Tisch noch existiert und die Person noch in den Raum gehört; alle
 * übrigen Personen füllen die freien Tische in Lesereihenfolge.
 *
 * Für eine Verteilung von vorne die bestehende Belegung vorher durch
 * `ohneFreieBelegung` schicken – dann bleiben nur Reserven und Vorgaben.
 */
export function verteileImRaum(
  schema: Raumschema,
  matrikelnummern: string[],
  bestehend: Platzbelegung[],
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
    const bleibt = !reserviert && !!alt?.matrikelnummer && offen.has(alt.matrikelnummer);
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
  let index = 0;
  for (const platz of belegung) {
    if (platz.reserviert || platz.matrikelnummer !== '') continue;
    if (index >= uebrig.length) break;
    platz.matrikelnummer = uebrig[index++];
  }

  return { belegung, ohnePlatz: uebrig.slice(index) };
}

/**
 * Alle Räume verteilen. `sitzplaetze` stammt aus `erstelleRaumzuteilung` und
 * legt fest, wer in welchen Raum kommt; das Schema legt fest, wo.
 */
export function verteileAufRaumschemata(
  sitzplaetze: Sitzplatz[],
  schemata: Raumschema[],
  bestehend: Platzbelegung[] = [],
): { belegung: Platzbelegung[]; ohnePlatz: Sitzplatz[] } {
  const belegung: Platzbelegung[] = [];
  const ohnePlatz: Sitzplatz[] = [];

  for (const schema of schemata) {
    const imRaum = sitzplaetze.filter((platz) => platz.raum === schema.raum);
    const ergebnis = verteileImRaum(schema, imRaum.map((p) => p.matrikelnummer), bestehend);
    belegung.push(...ergebnis.belegung);
    for (const nummer of ergebnis.ohnePlatz) {
      const person = imRaum.find((p) => p.matrikelnummer === nummer);
      if (person) ohnePlatz.push(person);
    }
  }

  // Personen in Räumen ohne Schema gelten als nicht platziert.
  const bekannteRaeume = new Set(schemata.map((s) => s.raum));
  for (const platz of sitzplaetze) {
    if (!bekannteRaeume.has(platz.raum)) ohnePlatz.push(platz);
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
  return belegung.map((platz) =>
    platz.raum === raum && imBereich(bereich, platz.zeile, platz.spalte)
      ? { ...platz, zeile: platz.zeile + dZeile, spalte: platz.spalte + dSpalte }
      : platz,
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

/** Vorgabe an-/abschalten (nur sinnvoll, wenn dort jemand sitzt). */
export function schalteVorgabe(belegung: Platzbelegung[], raum: string, zeile: number, spalte: number): Platzbelegung[] {
  return belegung.map((platz) =>
    platz.raum === raum && platz.zeile === zeile && platz.spalte === spalte && platz.matrikelnummer !== ''
      ? { ...platz, vorgabe: !platz.vorgabe }
      : platz,
  );
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
