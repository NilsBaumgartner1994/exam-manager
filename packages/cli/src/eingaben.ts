/**
 * Woher ein Befehl seine Eingaben nimmt.
 *
 * Drei Wege, in dieser Reihenfolge: der Pfad im Aufruf, der gleichnamige
 * Schalter, der Projektordner (`--projekt`). So lässt sich jeder Schritt
 * einzeln aufrufen – und mit einem Projektordner ohne jeden Pfad, genau wie
 * die Screens sich dort selbst bedienen. Fehlt am Ende etwas, sagt die
 * Meldung, welcher der drei Wege gefehlt hat, statt „Datei nicht gefunden“.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { DateiRolle, dateiMuster, erkenneRolle, projektPfad, ROLLEN_TITEL } from '@exam-manager/core';
import { Argumente, FehlendeAngabe, text } from './argumente';
import { Projekt } from './projektordner';

/** Der Projektordner aus `--projekt`, falls einer angegeben wurde. */
export function projektAus(args: Argumente): Projekt | undefined {
  const ordner = text(args, 'projekt');
  if (ordner === undefined) return undefined;
  if (!existsSync(ordner) || !statSync(ordner).isDirectory()) {
    throw new FehlendeAngabe(`Kein Ordner: ${ordner}`);
  }
  return new Projekt(ordner);
}

export interface Quelle {
  /** Woher die Datei stammt – steht in der Ausgabe, damit die Zahlen eine Herkunft haben. */
  pfad: string;
  text: string;
}

interface Gesucht {
  /** Pfad aus dem Aufruf (die Position), falls angegeben. */
  pfad?: string;
  /** Name des Schalters, der dieselbe Datei angeben kann. */
  schalter: string;
  /** Rolle im Projektordner. */
  rolle: DateiRolle;
  projekt?: Projekt;
  args: Argumente;
}

/** Eine Textdatei einlesen – aus Pfad, Schalter oder Projektordner. */
export function lieseQuelle({ pfad, schalter, rolle, projekt, args }: Gesucht): Quelle {
  const gewaehlt = pfad ?? text(args, schalter);
  if (gewaehlt !== undefined) return { pfad: gewaehlt, text: lieseDatei(gewaehlt) };
  const ausProjekt = projekt?.eine(rolle);
  if (ausProjekt) return { pfad: ausProjekt.datei, text: readFileSync(ausProjekt.datei, 'utf-8') };
  throw new FehlendeAngabe(
    `Es fehlt: ${ROLLEN_TITEL[rolle]} – als Pfad, mit --${schalter} oder im Projektordner unter ${dateiMuster(rolle)}.`,
  );
}

/** Mehrere Textdateien einer Rolle – ein Ordner oder alles aus dem Projekt. */
export function lieseQuellen({ pfad, schalter, rolle, projekt, args }: Gesucht): Quelle[] {
  const gewaehlt = pfad ?? text(args, schalter);
  if (gewaehlt !== undefined) {
    if (!existsSync(gewaehlt)) throw new FehlendeAngabe(`Nicht gefunden: ${gewaehlt}`);
    if (statSync(gewaehlt).isDirectory()) {
      // Aus einem Ordner wird genommen, was dort auch die App nähme: Der
      // Name und die Kopfzeile entscheiden (`erkenneRolle`). Sonst läse eine
      // alte `raeume.csv` als Raster einen Raum namens „Plätze“ ein.
      return readdirSync(gewaehlt)
        .sort()
        .map((name) => ({ name, datei: join(gewaehlt, name) }))
        .filter(({ name, datei }) => {
          if (!name.toLowerCase().endsWith('.csv') || statSync(datei).isDirectory()) return false;
          const kopf = readFileSync(datei, 'utf-8').split('\n')[0];
          return erkenneRolle(projektPfad(rolle, name), kopf) === rolle;
        })
        .map(({ datei }) => ({ pfad: datei, text: lieseDatei(datei) }));
    }
    return [{ pfad: gewaehlt, text: lieseDatei(gewaehlt) }];
  }
  const ausProjekt = projekt?.alle(rolle) ?? [];
  if (ausProjekt.length > 0) {
    return ausProjekt.map((datei) => ({
      pfad: datei.datei,
      text: readFileSync(datei.datei, 'utf-8'),
    }));
  }
  throw new FehlendeAngabe(
    `Es fehlt: ${ROLLEN_TITEL[rolle]} – als Pfad (Datei oder Ordner), mit --${schalter} oder im Projektordner unter ${dateiMuster(rolle)}.`,
  );
}

/** Datei lesen, mit einer Meldung, die den Pfad nennt. */
export function lieseDatei(pfad: string): string {
  if (!existsSync(pfad)) throw new FehlendeAngabe(`Datei nicht gefunden: ${pfad}`);
  if (statSync(pfad).isDirectory()) throw new FehlendeAngabe(`Das ist ein Ordner, keine Datei: ${pfad}`);
  return readFileSync(pfad, 'utf-8');
}

/** Datei schreiben und den Pfad melden – Ordner darüber entstehen mit. */
export function schreibeDatei(pfad: string, inhalt: string | Uint8Array): void {
  mkdirSync(dirname(pfad), { recursive: true });
  writeFileSync(pfad, inhalt);
  console.log(`geschrieben: ${Projekt.kurz(pfad)}`);
}
