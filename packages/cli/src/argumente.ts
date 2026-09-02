/**
 * Argumente der Kommandozeile lesen – und, wenn etwas fehlt, eine Hilfe
 * ausgeben statt einer Fehlermeldung.
 *
 * Jeder Befehl beschreibt sich selbst (`BefehlBeschreibung`): welche Pfade er
 * in welcher Reihenfolge erwartet und welche Schalter es gibt. Daraus entsteht
 * beides – die Prüfung der Eingabe und der Hilfetext. Zwei getrennte Stellen
 * liefen auseinander, sobald ein Schalter dazukommt.
 */

/** Ein Pfad, den ein Befehl an einer festen Stelle erwartet. */
export interface Position {
  /** Name in der Hilfe, z. B. `Notenliste.csv`. */
  name: string;
  beschreibung: string;
}

/** Ein Schalter (`--min_points 30`) oder ein Ja/Nein-Schalter (`--hilfe`). */
export interface Schalter {
  name: string;
  beschreibung: string;
  /** `zahl`/`text`/`pfad` erwarten einen Wert dahinter, `ja` steht für sich. */
  art: 'zahl' | 'text' | 'pfad' | 'ja';
  pflicht?: boolean;
  /** Vorbelegung, wenn der Schalter fehlt – steht so auch in der Hilfe. */
  standard?: string | number;
}

export interface BefehlBeschreibung {
  /** Aufruf ohne `yarn`, z. B. `1_vips`. */
  name: string;
  /** Der Screen, den der Befehl auf der Kommandozeile nachbildet. */
  titel: string;
  beschreibung: string;
  positionen: Position[];
  schalter: Schalter[];
  /** Ein oder zwei Aufrufe, die wirklich funktionieren. */
  beispiele: string[];
}

/** Die gelesenen Argumente eines Aufrufs. */
export interface Argumente {
  positionen: string[];
  schalter: Map<string, string | true>;
}

/**
 * Fehlende oder falsche Angabe. Wird oben abgefangen: Der Aufrufer bekommt die
 * Hilfe des Befehls zu sehen, mit diesem Satz obendrüber.
 */
export class FehlendeAngabe extends Error {}

/**
 * `--name wert`, `--name=wert` und `--name` einlesen; alles andere ist ein
 * Pfad. Unterstriche und Bindestriche gelten als dasselbe Zeichen
 * (`--min_points` = `--min-points`): Wer tippt, soll nicht raten müssen.
 */
export function lieseArgumente(argv: string[]): Argumente {
  const positionen: string[] = [];
  const schalter = new Map<string, string | true>();
  for (let i = 0; i < argv.length; i++) {
    const teil = argv[i];
    if (!teil.startsWith('--')) {
      positionen.push(teil);
      continue;
    }
    const [name, ...rest] = teil.slice(2).split('=');
    const schluessel = schalterName(name);
    if (rest.length > 0) {
      schalter.set(schluessel, rest.join('='));
      continue;
    }
    const naechstes = argv[i + 1];
    if (naechstes !== undefined && !naechstes.startsWith('--')) {
      schalter.set(schluessel, naechstes);
      i++;
    } else {
      schalter.set(schluessel, true);
    }
  }
  return { positionen, schalter };
}

/** Vergleichsform eines Schalternamens: klein, ohne `-`/`_`. */
function schalterName(name: string): string {
  return name.toLowerCase().replace(/[-_]/g, '');
}

/** Wert eines Schalters – `undefined`, wenn er nicht angegeben wurde. */
export function text(args: Argumente, name: string): string | undefined {
  const wert = args.schalter.get(schalterName(name));
  if (wert === undefined) return undefined;
  if (wert === true) throw new FehlendeAngabe(`--${name} braucht einen Wert.`);
  return wert;
}

/** Ja/Nein-Schalter: steht er da? */
export function gesetzt(args: Argumente, name: string): boolean {
  return args.schalter.has(schalterName(name));
}

/** Zahl eines Schalters, mit Vorbelegung. `--min_points abc` ist ein Fehler. */
export function zahl(args: Argumente, name: string, standard?: number): number {
  const roh = text(args, name);
  if (roh === undefined) {
    if (standard === undefined) throw new FehlendeAngabe(`Es fehlt: --${name}`);
    return standard;
  }
  const wert = Number(roh.replace(',', '.'));
  if (!Number.isFinite(wert)) throw new FehlendeAngabe(`--${name} ist keine Zahl: „${roh}“`);
  return wert;
}

/** Pflichtwert eines Schalters. */
export function pflichtText(args: Argumente, name: string): string {
  const wert = text(args, name);
  if (wert === undefined) throw new FehlendeAngabe(`Es fehlt: --${name}`);
  return wert;
}

/**
 * Schalter, die jeder Befehl kennt. Sie stehen nicht in den einzelnen
 * Beschreibungen: Einer davon würde sonst irgendwann vergessen, und in der
 * Hilfe fehlte er genau dort, wo jemand ihn sucht.
 */
export const ALLGEMEINE_SCHALTER: Schalter[] = [
  {
    name: 'verbose',
    art: 'ja',
    beschreibung: 'ausführlich: gelesene Dateien, übersprungene Dateien, Zwischenzahlen',
  },
  { name: 'hilfe', art: 'ja', beschreibung: 'diese Hilfe anzeigen (auch --help)' },
];

/** Wurde `--verbose` (oder `--ausfuehrlich`) angegeben? */
export function istVerbose(args: Argumente): boolean {
  return gesetzt(args, 'verbose') || gesetzt(args, 'ausfuehrlich');
}

/**
 * Der Hilfetext eines Befehls: Aufruf, Pfade, Schalter, Beispiele.
 *
 * Er ist die Antwort auf jede unvollständige Eingabe – deshalb steht dort
 * alles, was man zum nächsten Versuch braucht, und nicht nur der Name des
 * fehlenden Schalters.
 */
export function hilfeText(befehl: BefehlBeschreibung): string {
  const zeilen: string[] = [];
  const pfade = befehl.positionen.map((pos) => `[<${pos.name}>]`).join(' ');
  zeilen.push(`${befehl.titel}`, '', befehl.beschreibung, '');
  zeilen.push(`Aufruf:  yarn ${befehl.name} ${pfade} [Schalter]`, '');
  if (befehl.positionen.length > 0) {
    zeilen.push('Pfade (jeder ist entbehrlich, solange --projekt ihn liefert):');
    for (const pos of befehl.positionen) {
      zeilen.push(`  ${feld(`<${pos.name}>`)}${pos.beschreibung}`);
    }
    zeilen.push('');
  }
  zeilen.push('Schalter:');
  for (const s of [...befehl.schalter, ...ALLGEMEINE_SCHALTER]) {
    const anzeige = s.art === 'ja' ? `--${s.name}` : `--${s.name} <${s.art}>`;
    const standard = s.standard === undefined ? '' : ` (Standard: ${s.standard})`;
    const pflicht = s.pflicht ? ' [nötig]' : '';
    zeilen.push(`  ${feld(anzeige)}${s.beschreibung}${standard}${pflicht}`);
  }
  zeilen.push('', 'Beispiele:');
  for (const beispiel of befehl.beispiele) zeilen.push(`  ${beispiel}`);
  return zeilen.join('\n');
}

/** Erste Spalte der Hilfe – auf feste Breite gebracht, damit die Sätze fluchten. */
function feld(text: string): string {
  return text.length >= 34 ? `${text}\n${' '.repeat(36)}` : text.padEnd(34, ' ') + '  ';
}

/** Die Übersicht über alle Befehle – die Antwort auf `yarn cli` ohne Argumente. */
export function uebersicht(befehle: BefehlBeschreibung[]): string {
  const zeilen = [
    'Exam Manager auf der Kommandozeile – dieselben Schritte wie in der Web-App.',
    '',
    'Aufruf:  yarn <befehl> [Pfade] [Schalter]',
    '         yarn <befehl> --hilfe     zeigt die Hilfe eines Befehls',
    '         yarn <befehl> --verbose   sagt dazu, was er gerade liest und rechnet',
    '',
    'Befehle:',
  ];
  for (const befehl of befehle) zeilen.push(`  ${feld(befehl.name)}${befehl.titel}`);
  zeilen.push(
    '',
    'Jeder Befehl nimmt seine Eingaben wahlweise als Pfade oder mit --projekt',
    'aus einem Projektordner (dieselben Ordner wie in der App, siehe README).',
  );
  return zeilen.join('\n');
}
