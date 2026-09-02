/**
 * Ein Projektordner auf der Platte – dieselbe Sicht, die die Web-App hat.
 *
 * Die App liest den gewählten Ordner nach `PROJEKT_SCHEMA` ein: Der Ordner
 * entscheidet, welche Rolle eine Datei hat. Auf der Kommandozeile gilt genau
 * dasselbe, damit `yarn 4_raumzuteilung --projekt Beispielprojekt` und der
 * Screen dieselben Dateien nehmen. Der Unterschied ist nur das Zurückschreiben:
 * Hier darf ein Ergebnis wirklich in den Ordner – der Browser darf das nicht.
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, sep } from 'path';
import { DateiRolle, erkenneRolle, projektPfad } from '@exam-manager/core';

export interface ProjektDatei {
  /** Pfad innerhalb des Projektordners, z. B. `Zulassungen/pv2025_zulassungen.csv`. */
  pfad: string;
  /** Voller Pfad auf der Platte. */
  datei: string;
  rolle: DateiRolle;
}

const TEXT_ENDUNGEN = ['.csv', '.txt', '.md', '.json'];

const istText = (name: string) => TEXT_ENDUNGEN.some((e) => name.toLowerCase().endsWith(e));

/** Alle Dateien unterhalb eines Ordners, mit Pfad relativ dazu. */
function alleDateien(wurzel: string, unter = ''): string[] {
  return readdirSync(join(wurzel, unter)).flatMap((name) => {
    const kind = unter === '' ? name : `${unter}${sep}${name}`;
    return statSync(join(wurzel, kind)).isDirectory()
      ? alleDateien(wurzel, kind)
      : [kind.split(sep).join('/')];
  });
}

/** Der Projektordner mit der Rolle jeder Datei (wie in der App). */
export class Projekt {
  readonly dateien: ProjektDatei[];

  constructor(readonly ordner: string) {
    this.dateien = alleDateien(ordner).map((pfad) => {
      const datei = join(ordner, ...pfad.split('/'));
      // Die Kopfzeile entscheidet dort, wo ein Ordner mehrere Rollen aufnimmt.
      const kopf = istText(pfad) ? readFileSync(datei, 'utf-8').split('\n')[0] : undefined;
      return { pfad, datei, rolle: erkenneRolle(pfad, kopf) };
    });
  }

  /** Alle Dateien einer Rolle, alphabetisch – wie die App sie auflistet. */
  alle(rolle: DateiRolle): ProjektDatei[] {
    return this.dateien
      .filter((datei) => datei.rolle === rolle)
      .sort((a, b) => a.pfad.localeCompare(b.pfad, 'de'));
  }

  /** Die erste Datei einer Rolle (bei mehreren die alphabetisch erste). */
  eine(rolle: DateiRolle): ProjektDatei | undefined {
    return this.alle(rolle)[0];
  }

  /** Inhalt aller Dateien einer Rolle als Text. */
  texte(rolle: DateiRolle): string[] {
    return this.alle(rolle).map((datei) => readFileSync(datei.datei, 'utf-8'));
  }

  /** Wohin ein Ergebnis dieser Rolle im Projekt gehört. */
  ziel(rolle: DateiRolle, dateiname: string): string {
    return join(this.ordner, ...projektPfad(rolle, dateiname).split('/'));
  }

  /** Pfad zum Anzeigen – relativ zum Arbeitsverzeichnis, wenn das kürzer ist. */
  static kurz(pfad: string): string {
    const rel = relative(process.cwd(), pfad);
    return rel !== '' && !rel.startsWith('..') && rel.length < pfad.length ? rel : pfad;
  }
}
