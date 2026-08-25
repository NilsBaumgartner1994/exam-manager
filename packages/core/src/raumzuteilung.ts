/**
 * Portierung von `4_MailRaumZuordnung/2_raum_zuteilung_erstellen/createRoomAssignment.py`:
 * Studierende auf Räume verteilen, Sitzplatznummern und eindeutige
 * Namenspräfixe (für den Aushang) vergeben.
 */
import { parseCsvObjects, toCsv } from './csv';
import { normalizeName } from './namen';
import { Raum, Sitzplatz, Zulassung } from './types';

export type Verteilmodus = 'balanced' | 'sequential';

/** Raumliste (`Raum;Plätze;ReservierteZeit`) einlesen. */
export function parseRaeume(csvText: string): Raum[] {
  return parseCsvObjects(csvText).map((row) => ({
    raum: row['Raum'] ?? '',
    plaetze: Number(row['Plätze'] ?? row['Plaetze'] ?? 0),
    reservierteZeit: row['ReservierteZeit'] ?? '',
  }));
}

export function raeumeToCsv(raeume: Raum[]): string {
  return toCsv([
    ['Raum', 'Plätze', 'ReservierteZeit'],
    ...raeume.map((r) => [r.raum, r.plaetze, r.reservierteZeit]),
  ]);
}

export interface RaumzuteilungsOptionen {
  modus: Verteilmodus;
  /** Erste vergebene Sitzplatznummer (Default 1001). */
  ersteSitzplatznummer?: number;
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
  const belegung = raeume.map((raum) => ({ raum, belegt: 0 }));
  const zuteilung: { person: Zulassung; raum: Raum }[] = [];
  const ohnePlatz: Zulassung[] = [];
  let raumIndex = 0;

  for (const person of teilnehmer) {
    let ziel: { raum: Raum; belegt: number } | undefined;
    if (optionen.modus === 'balanced') {
      ziel = [...belegung]
        .filter((b) => b.belegt < b.raum.plaetze)
        .sort((a, b) => a.belegt / a.raum.plaetze - b.belegt / b.raum.plaetze)[0];
    } else {
      while (raumIndex < belegung.length && belegung[raumIndex].belegt >= belegung[raumIndex].raum.plaetze) {
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

  // Sitzplatznummern: sortiert nach Zeit+Raum, dann Nachname (normalisiert)
  zuteilung.sort((a, b) => {
    const zeitRaumA = `${a.raum.reservierteZeit} - ${a.raum.raum}`;
    const zeitRaumB = `${b.raum.reservierteZeit} - ${b.raum.raum}`;
    if (zeitRaumA !== zeitRaumB) return zeitRaumA.localeCompare(zeitRaumB);
    return normalizeName(a.person.nachname).localeCompare(normalizeName(b.person.nachname));
  });

  const start = optionen.ersteSitzplatznummer ?? 1001;
  const praefixe = eindeutigeNamenspraefixe(zuteilung.map(({ person }) => person));

  const sitzplaetze = zuteilung.map(({ person, raum }, i) => ({
    anfangNachname: praefixe.get(person) ?? person.nachname,
    sitzplatznummer: start + i,
    raum: raum.raum,
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
    reservierteZeit: row['ReservierteZeit'] ?? '',
    matrikelnummer: row['Matrikelnummer'] ?? '',
    anwesend: row['Anwesend'] ?? '',
    nachname: row['Nachname'] ?? '',
    vorname: row['Vorname'] ?? '',
    zeitUndRaum: row['Zeit_und_Raum'] ?? '',
    email: row['Email'] ?? '',
  }));
}
