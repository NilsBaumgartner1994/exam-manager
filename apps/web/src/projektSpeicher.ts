/**
 * Der Projektstand im Browserspeicher.
 *
 * Ein Neuladen der Seite soll nichts kosten: Wer den Ordner einmal ausgewählt
 * hat, findet ihn samt aller Ergebnisse wieder vor. Gespeichert wird deshalb
 * in `localStorage` – im Profil des Browsers, auf diesem Gerät, ohne Server.
 *
 * **Das sind Personendaten.** Sie bleiben liegen, bis sie jemand entfernt: Auf
 * der Startseite tut das „Projekt schließen“. Wer an einem fremden Rechner
 * arbeitet, sollte das nicht vergessen – dafür steht der Hinweis dort.
 *
 * `localStorage` fasst nur wenige Megabyte und nur Text. Binärdateien (PDFs,
 * Excel) werden deshalb Base64-kodiert, und wenn der Platz nicht reicht,
 * bleiben zuerst sie draußen: Ein Raster oder eine Zulassungsliste ist beim
 * nächsten Öffnen wichtiger als eine PDF, die sich neu erzeugen lässt. Was
 * fehlt, sagt `SpeicherErgebnis` – die Startseite schreibt es hin, statt es
 * stillschweigend zu verlieren.
 */

/** Schlüssel im `localStorage`; die Zahl steigt, wenn sich das Format ändert. */
const SPEICHER_SCHLUESSEL = 'exam-manager.projekt.v1';

/**
 * Ab hier wird gar nicht erst versucht zu speichern (in Zeichen). Browser
 * geben meist 5 MB je Herkunft frei; darunter bleibt Luft für alles andere.
 */
const PLATZ_GRENZE = 4_000_000;

/** Eine Datei, wie sie im Speicher steht – Bytes als Base64. */
interface GespeicherteDatei {
  pfad: string;
  rolle: string;
  text?: string;
  base64?: string;
}

interface GespeicherterStand {
  ordner: string | null;
  dateien: GespeicherteDatei[];
}

/** Was vom Stand tatsächlich im Browser liegt. */
export type SpeicherErgebnis =
  | { art: 'alles' }
  /** Nur die Textdateien – für die Binärdateien war kein Platz. */
  | { art: 'ohneBinaer'; ausgelassen: number }
  /** Nichts: Der Browser lässt kein Speichern zu (privates Fenster, Quota). */
  | { art: 'nichts' };

function base64Aus(bytes: Uint8Array): string {
  // In Häppchen, sonst sprengt ein großes PDF den Aufruf-Stack.
  const haeppchen = 0x8000;
  let roh = '';
  for (let i = 0; i < bytes.length; i += haeppchen) {
    roh += String.fromCharCode(...bytes.subarray(i, i + haeppchen));
  }
  return btoa(roh);
}

function bytesAus(base64: string): Uint8Array {
  const roh = atob(base64);
  const bytes = new Uint8Array(roh.length);
  for (let i = 0; i < roh.length; i++) bytes[i] = roh.charCodeAt(i);
  return bytes;
}

interface StandDatei {
  pfad: string;
  rolle: string;
  text?: string;
  bytes?: Uint8Array;
}

export interface StandZumSpeichern {
  ordner: string | null;
  dateien: StandDatei[];
}

function schreibe(text: string): boolean {
  try {
    localStorage.setItem(SPEICHER_SCHLUESSEL, text);
    return true;
  } catch {
    // Quota voll oder Speichern verboten (privates Fenster).
    return false;
  }
}

/**
 * Den Stand ablegen. Reicht der Platz nicht, wandern zuerst die Binärdateien
 * heraus; klappt auch das nicht, bleibt der Speicher leer (und der alte Stand
 * wird entfernt, damit nichts Halbes zurückbleibt).
 */
export function sichereStand(stand: StandZumSpeichern): SpeicherErgebnis {
  if (typeof localStorage === 'undefined') return { art: 'nichts' };

  const mitBinaer: GespeicherterStand = {
    ordner: stand.ordner,
    dateien: stand.dateien.map((datei) => ({
      pfad: datei.pfad,
      rolle: datei.rolle,
      ...(datei.text !== undefined ? { text: datei.text } : {}),
      ...(datei.bytes ? { base64: base64Aus(datei.bytes) } : {}),
    })),
  };
  const alles = JSON.stringify(mitBinaer);
  if (alles.length <= PLATZ_GRENZE && schreibe(alles)) return { art: 'alles' };

  const nurText: GespeicherterStand = {
    ordner: stand.ordner,
    dateien: mitBinaer.dateien.filter((datei) => datei.text !== undefined),
  };
  const ausgelassen = mitBinaer.dateien.length - nurText.dateien.length;
  const knapp = JSON.stringify(nurText);
  if (knapp.length <= PLATZ_GRENZE && schreibe(knapp)) {
    return ausgelassen > 0 ? { art: 'ohneBinaer', ausgelassen } : { art: 'alles' };
  }

  loescheStand();
  return { art: 'nichts' };
}

/** Den gespeicherten Stand holen – `null`, wenn keiner (oder ein kaputter) da ist. */
export function ladeStand(): StandZumSpeichern | null {
  if (typeof localStorage === 'undefined') return null;
  let roh: string | null = null;
  try {
    roh = localStorage.getItem(SPEICHER_SCHLUESSEL);
  } catch {
    return null;
  }
  if (!roh) return null;
  try {
    const stand = JSON.parse(roh) as GespeicherterStand;
    if (!Array.isArray(stand?.dateien)) return null;
    return {
      ordner: stand.ordner ?? null,
      dateien: stand.dateien.map((datei) => ({
        pfad: datei.pfad,
        rolle: datei.rolle,
        ...(datei.text !== undefined ? { text: datei.text } : {}),
        ...(datei.base64 ? { bytes: bytesAus(datei.base64) } : {}),
      })),
    };
  } catch {
    // Ein unlesbarer Stand ist schlimmer als keiner.
    loescheStand();
    return null;
  }
}

/** Den Stand aus dem Browser entfernen. */
export function loescheStand(): void {
  try {
    localStorage?.removeItem(SPEICHER_SCHLUESSEL);
  } catch {
    // Nichts zu tun: Wo nicht gespeichert werden darf, liegt auch nichts.
  }
}
