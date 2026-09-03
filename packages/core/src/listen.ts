/**
 * Die Listen, die aus einer Klausur herausfallen – für Aushang, Einlass und
 * Aufsicht.
 *
 * Sie stehen hier und nicht im Screen, weil sie **eine** Beschreibung haben
 * sollen: dieselben Spalten, dieselbe Sortierung und dieselben Zeilen, egal
 * ob daraus eine CSV-Datei wird oder eine gedruckte Tabelle. Vorher gab es je
 * Ausgabe eine eigene Zusammenstellung, und die liefen auseinander – die
 * Tutorenliste hatte im PDF eine Spalte, die in der CSV fehlte.
 *
 * Der Aufbau ist bewusst schlicht: Spalten mit Schlüssel und Überschrift,
 * dazu Abschnitte mit Zeilen. Ein Abschnitt ist bei den meisten Listen die
 * ganze Liste; bei der Aufsichtsliste ist es ein Raumeinsatz – die geht je
 * Raum getrennt in die Hand der Aufsicht.
 */
import { toCsv } from './csv';
import { normalizeName, sortByNachname } from './namen';
import { raumSchluessel } from './raumzuteilung';
import { Raum, Sitzplatz } from './types';

/**
 * Welche Liste:
 *
 * - `teilnehmer` – alle Angaben zu jeder Person (die Liste, aus der sich alles
 *   andere ableiten lässt),
 * - `tutoren` – nach Nachname, zum Einweisen am Einlass: „Wo sitze ich?“,
 * - `aufsicht` – je Raumeinsatz die Personen darin, nach Sitzplatznummer,
 * - `aushang` – das Blatt an der Saaltür: Namenskürzel und Platznummer.
 */
export type ListenArt = 'teilnehmer' | 'tutoren' | 'aufsicht' | 'aushang';

export interface ListenSpalte {
  /** Schlüssel in den Zeilen. */
  key: string;
  titel: string;
}

export interface ListenAbschnitt {
  /** Überschrift – nur, wo eine Liste in Teile zerfällt (je Raumeinsatz). */
  titel?: string;
  /** Zusatz unter der Überschrift, etwa die reservierte Zeit. */
  untertitel?: string;
  /** Für den Dateinamen, wenn je Abschnitt eine Datei entsteht. */
  kennung?: string;
  zeilen: Record<string, string | number>[];
}

export interface Liste {
  art: ListenArt;
  /** Überschrift der Ausgabe („Aufsichtsliste je Raum“). */
  titel: string;
  /** Dateiname ohne Endung. */
  dateiname: string;
  spalten: ListenSpalte[];
  abschnitte: ListenAbschnitt[];
  /**
   * Je Abschnitt eine eigene Datei (Aufsichtsliste): Die Aufsicht bekommt das
   * Blatt ihres Raums und nicht die Liste aller Räume.
   */
  jeAbschnittEineDatei: boolean;
}

const SPALTEN: Record<ListenArt, ListenSpalte[]> = {
  teilnehmer: [
    { key: 'anfangNachname', titel: 'Anfang Nachname' },
    { key: 'sitzplatznummer', titel: 'Sitzplatznummer' },
    { key: 'zeitUndRaum', titel: 'Zeit und Raum' },
    { key: 'matrikelnummer', titel: 'Matrikelnummer' },
    { key: 'anwesend', titel: 'Anwesend' },
    { key: 'nachname', titel: 'Nachname' },
    { key: 'vorname', titel: 'Vorname' },
    { key: 'email', titel: 'E-Mail' },
  ],
  tutoren: [
    { key: 'nachname', titel: 'Nachname' },
    { key: 'vorname', titel: 'Vorname' },
    { key: 'matrikelnummer', titel: 'Matrikelnummer' },
    { key: 'zeitUndRaum', titel: 'Zeit und Raum' },
    { key: 'sitzplatznummer', titel: 'Sitzplatznummer' },
  ],
  aufsicht: [
    { key: 'sitzplatznummer', titel: 'Sitzplatznummer' },
    { key: 'nachname', titel: 'Nachname' },
    { key: 'vorname', titel: 'Vorname' },
    { key: 'matrikelnummer', titel: 'Matrikelnummer' },
    { key: 'anwesend', titel: 'Anwesend' },
    { key: 'zeitUndRaum', titel: 'Zeit und Raum' },
  ],
  aushang: [
    { key: 'anfangNachname', titel: 'Anfang Nachname' },
    { key: 'sitzplatznummer', titel: 'Sitzplatznummer' },
    { key: 'zeitUndRaum', titel: 'Zeit und Raum' },
  ],
};

const TITEL: Record<ListenArt, { titel: string; dateiname: string }> = {
  teilnehmer: { titel: 'Teilnehmendenliste', dateiname: 'teilnehmendenliste' },
  tutoren: { titel: 'Tutorenliste (Einlass)', dateiname: 'tutorenliste' },
  aufsicht: { titel: 'Aufsichtsliste je Raum', dateiname: 'aufsichtsliste' },
  aushang: { titel: 'Aushang', dateiname: 'aushang' },
};

/** Eine Zeile aus einem Sitzplatz – die Spalten greifen darauf zu. */
function zeile(platz: Sitzplatz): Record<string, string | number> {
  return {
    anfangNachname: platz.anfangNachname,
    sitzplatznummer: platz.sitzplatznummer,
    zeitUndRaum: platz.zeitUndRaum,
    raum: platz.raum,
    reservierteZeit: platz.reservierteZeit,
    matrikelnummer: platz.matrikelnummer,
    anwesend: platz.anwesend,
    nachname: platz.nachname,
    vorname: platz.vorname,
    email: platz.email,
  };
}

/** Nach Sitzplatznummer – die Reihenfolge, in der die Aufsicht durchgeht. */
function nachNummer(plaetze: Sitzplatz[]): Sitzplatz[] {
  return [...plaetze].sort((a, b) => a.sitzplatznummer - b.sitzplatznummer);
}

/**
 * Nach Nachname, bei gleichem Nachnamen nach Vorname: Am Einlass steht die
 * Frage „wo sitze ich?“, und gesucht wird über den Namen.
 */
function nachNamen(plaetze: Sitzplatz[]): Sitzplatz[] {
  return sortByNachname(plaetze).sort((a, b) => {
    const nachname = normalizeName(a.nachname)
      .toLowerCase()
      .localeCompare(normalizeName(b.nachname).toLowerCase());
    if (nachname !== 0) return nachname;
    return normalizeName(a.vorname)
      .toLowerCase()
      .localeCompare(normalizeName(b.vorname).toLowerCase());
  });
}

/**
 * Eine Liste zusammenstellen. `raeume` gibt die Reihenfolge der Abschnitte der
 * Aufsichtsliste vor – die Räume stehen so, wie sie in der Klausur benutzt
 * werden, nicht alphabetisch.
 */
export function baueListe(art: ListenArt, sitzplaetze: Sitzplatz[], raeume: Raum[] = []): Liste {
  const { titel, dateiname } = TITEL[art];
  const grundlage: Liste = {
    art,
    titel,
    dateiname,
    spalten: SPALTEN[art],
    abschnitte: [],
    jeAbschnittEineDatei: art === 'aufsicht',
  };

  if (art === 'aufsicht') {
    // Je Raumeinsatz ein Abschnitt – auch Räume ohne Personen, damit sichtbar
    // bleibt, dass dort keiner sitzt.
    const einsaetze = raeume.length > 0 ? raeume.map(raumSchluessel) : einsaetzeAus(sitzplaetze);
    return {
      ...grundlage,
      abschnitte: einsaetze.map((schluessel) => {
        const imRaum = nachNummer(
          sitzplaetze.filter((platz) => platz.raumSchluessel === schluessel),
        );
        return {
          titel: schluessel,
          untertitel: imRaum[0]?.reservierteZeit ?? '',
          kennung: schluessel,
          zeilen: imRaum.map(zeile),
        };
      }),
    };
  }

  const sortiert =
    art === 'tutoren'
      ? nachNamen(sitzplaetze)
      : art === 'aushang'
        ? [...sitzplaetze].sort((a, b) =>
            a.anfangNachname.localeCompare(b.anfangNachname, 'de'),
          )
        : nachNummer(sitzplaetze);
  return { ...grundlage, abschnitte: [{ zeilen: sortiert.map(zeile) }] };
}

/** Die Raumeinsätze, die in einer Sitzplatzliste vorkommen (Reihenfolge bleibt). */
function einsaetzeAus(sitzplaetze: Sitzplatz[]): string[] {
  return [...new Set(sitzplaetze.map((platz) => platz.raumSchluessel))];
}

/**
 * Eine Liste als CSV. Ohne Abschnitt: alle hintereinander, je Abschnitt eine
 * Zeile mit seiner Überschrift davor (sonst wüsste niemand, wo der nächste
 * Raum anfängt).
 */
export function listeAlsCsv(liste: Liste, abschnitt?: ListenAbschnitt): string {
  const kopf = liste.spalten.map((spalte) => spalte.titel);
  const teile = abschnitt ? [abschnitt] : liste.abschnitte;
  const zeilen: (string | number)[][] = [];
  for (const teil of teile) {
    if (teil.titel && !abschnitt) zeilen.push([teil.titel, teil.untertitel ?? '']);
    zeilen.push(kopf);
    for (const eintrag of teil.zeilen) {
      zeilen.push(liste.spalten.map((spalte) => eintrag[spalte.key] ?? ''));
    }
  }
  return toCsv(zeilen);
}

/**
 * Die Dateien einer Liste: eine – oder je Abschnitt eine, wenn die Liste so
 * gedacht ist (Aufsichtsliste). Schlüssel ist der Dateiname mit Endung.
 */
export function listenDateien(liste: Liste): Map<string, string> {
  if (!liste.jeAbschnittEineDatei) {
    return new Map([[`${liste.dateiname}.csv`, listeAlsCsv(liste)]]);
  }
  const dateien = new Map<string, string>();
  for (const abschnitt of liste.abschnitte) {
    const name = `${liste.dateiname}_${dateiKennung(abschnitt.kennung ?? '')}.csv`;
    dateien.set(name, listeAlsCsv(liste, abschnitt));
  }
  return dateien;
}

/** Aus `94/E01 (2. Durchgang)` wird `94_E01_2_Durchgang` – Dateinamen ohne Sonderzeichen. */
export function dateiKennung(schluessel: string): string {
  return (
    normalizeName(schluessel)
      .replace(/[^A-Za-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'raum'
  );
}
