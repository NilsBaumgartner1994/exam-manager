#!/usr/bin/env node
/**
 * Der Einstieg: `yarn <befehl> …`.
 *
 * Die Web-App und die Kommandozeile sind zwei Oberflächen derselben
 * Fachlogik – jeder Screen hat hier seinen Befehl, mit denselben Eingaben und
 * denselben Zahlen. Wer skripten will, braucht dafür keinen Browser; wer
 * klicken will, keinen Terminal.
 *
 * Fehlt etwas im Aufruf, kommt die Hilfe des Befehls, nicht bloß eine
 * Fehlermeldung: Auf der Kommandozeile ist die Hilfe das, was in der App das
 * Formular ist – sie sagt, was noch fehlt.
 */
import { existsSync, statSync } from 'fs';
import { BEFEHLE } from './befehle';
import { FehlendeAngabe, hilfeText, lieseArgumente, uebersicht } from './argumente';

/**
 * Relative Pfade meinen das Verzeichnis, in dem der Befehl getippt wurde.
 *
 * `yarn` führt Skripte im Wurzelverzeichnis des Projekts aus, der
 * Workspace-Aufruf sogar in `packages/cli` – `yarn 5_raeume Raeume/` suchte
 * den Ordner sonst irgendwo, nur nicht dort, wo er steht. Wo getippt wurde,
 * merkt sich yarn in `INIT_CWD`.
 */
function inDasVerzeichnisDesAufrufs(): void {
  const start = process.env.INIT_CWD;
  if (start === undefined || !existsSync(start) || !statSync(start).isDirectory()) return;
  process.chdir(start);
}

async function main(argv: string[]): Promise<number> {
  inDasVerzeichnisDesAufrufs();
  const [name, ...rest] = argv;
  if (name === undefined || name === '--hilfe' || name === '--help' || name === 'hilfe') {
    console.log(uebersicht(BEFEHLE.map((befehl) => befehl.beschreibung)));
    return 0;
  }

  const befehl = BEFEHLE.find((eintrag) => eintrag.beschreibung.name === name);
  if (!befehl) {
    console.error(`Unbekannter Befehl: ${name}`);
    console.error('');
    console.error(uebersicht(BEFEHLE.map((eintrag) => eintrag.beschreibung)));
    return 1;
  }

  const args = lieseArgumente(rest);
  if (args.schalter.has('hilfe') || args.schalter.has('help')) {
    console.log(hilfeText(befehl.beschreibung));
    return 0;
  }

  try {
    await befehl.ausfuehren(args);
    return 0;
  } catch (fehler) {
    // Eine fehlende Angabe ist kein Absturz, sondern eine Rückfrage: erst der
    // Satz, was fehlt, dann die Hilfe – in dieser Reihenfolge, damit der Satz
    // nicht am oberen Rand aus dem Terminal läuft.
    if (fehler instanceof FehlendeAngabe) {
      console.error(hilfeText(befehl.beschreibung));
      console.error('');
      console.error(fehler.message);
      return 1;
    }
    console.error(fehler instanceof Error ? fehler.message : String(fehler));
    return 1;
  }
}

void main(process.argv.slice(2)).then((code) => {
  process.exitCode = code;
});
