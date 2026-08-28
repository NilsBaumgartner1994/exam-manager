/**
 * Vorlagen für die erzeugten PDFs: Markdown mit Platzhaltern.
 *
 * Der Text der Schreiben an Studierende ändert sich jedes Semester – ein
 * anderer Hinweis, eine andere Uhrzeit, ein anderer Ton. Er gehört deshalb
 * nicht in den Quelltext, sondern in eine Vorlage, die in der App bearbeitet
 * werden kann. Was hier steht, ist nur noch der Anfangstext.
 *
 * Zwei Dinge kann die Vorlage:
 *
 * - **Platzhalter** in spitzen Klammern (`<Vorname>`) werden je Person
 *   ersetzt. Ein unbekannter Platzhalter bleibt stehen, statt zu
 *   verschwinden – ein Tippfehler soll im PDF auffallen und nicht ein Feld
 *   still leeren.
 * - **Markdown**, allerdings nur so viel, wie ein Anschreiben braucht:
 *   Überschriften (`#`, `##`, `###`), fett (`**so**`), kursiv (`*so*`),
 *   Aufzählungen (`- `, `1. `) und Trennlinien (`---`).
 *
 * Anders als in Markdown üblich beginnt **jede Zeile eine neue Zeile**: Ein
 * Anschreiben wird zeilenweise gesetzt, nicht zu einem Fließtextabsatz
 * zusammengezogen. Eine Leerzeile ist ein Abstand, zwei Leerzeilen ein
 * größerer.
 */
import { Sitzplatz, Zulassung } from './types';

/** Ein Stück Text mit einheitlichem Schnitt. */
export interface TextStueck {
  text: string;
  fett?: boolean;
  kursiv?: boolean;
}

/** Was in einer Zeile der Vorlage steht. */
export type BlockArt = 'absatz' | 'ueberschrift' | 'punkt' | 'linie';

/** Eine gesetzte Zeile der Vorlage – das, was die PDF-Erzeugung zeichnet. */
export interface MarkdownBlock {
  art: BlockArt;
  stuecke: TextStueck[];
  /** Schriftgröße im Verhältnis zum Fließtext (1 = Fließtext). */
  faktor: number;
  /** Ganzer Block halbfett (Überschriften). */
  fett: boolean;
  /** Aufzählungszeichen vor dem Text („-“, „1.“) – nur bei `punkt`. */
  marke?: string;
  /** Leerzeilen über dem Block. */
  leerzeilenDavor: number;
}

/** Größe der Überschriften im Verhältnis zum Fließtext (`#`, `##`, `###`). */
const UEBERSCHRIFT_FAKTOR = [1.6, 1.3, 1.15];

/**
 * Fett und kursiv innerhalb einer Zeile.
 *
 * Nur Sternchen zählen: `**fett**` und `*kursiv*`. Unterstriche bleiben
 * Text – sonst würde aus `94_E01 bis 94_E03` mitten im Satz Kursivschrift.
 */
export function inlineStuecke(text: string, fett = false, kursiv = false): TextStueck[] {
  const stuecke: TextStueck[] = [];
  let zuletzt = 0;
  // Drei Sternchen zuerst: `***so***` ist beides. Danach fett, dann kursiv –
  // umgekehrt griffe `**` in die drei hinein und ließe ein Sternchen stehen.
  const muster = /\*\*\*([\s\S]+?)\*\*\*|\*\*([\s\S]+?)\*\*|\*([\s\S]+?)\*/g;
  for (const treffer of text.matchAll(muster)) {
    const start = treffer.index ?? 0;
    if (start > zuletzt) stuecke.push({ text: text.slice(zuletzt, start), fett, kursiv });
    const [beides, nurFett, nurKursiv] = [treffer[1], treffer[2], treffer[3]];
    const inhalt = beides ?? nurFett ?? nurKursiv ?? '';
    stuecke.push(
      ...inlineStuecke(
        inhalt,
        fett || beides !== undefined || nurFett !== undefined,
        kursiv || beides !== undefined || nurKursiv !== undefined,
      ),
    );
    zuletzt = start + treffer[0].length;
  }
  if (zuletzt < text.length) stuecke.push({ text: text.slice(zuletzt), fett, kursiv });
  return stuecke.filter((stueck) => stueck.text !== '');
}

/** Eine nicht leere Zeile einlesen. */
function blockAus(zeile: string): Omit<MarkdownBlock, 'leerzeilenDavor'> {
  const ueberschrift = /^(#{1,3})\s+(.*)$/.exec(zeile);
  if (ueberschrift) {
    return {
      art: 'ueberschrift',
      stuecke: inlineStuecke(ueberschrift[2], true),
      faktor: UEBERSCHRIFT_FAKTOR[ueberschrift[1].length - 1],
      fett: true,
    };
  }
  if (/^(-{3,}|_{3,}|\*{3,})$/.test(zeile)) {
    return { art: 'linie', stuecke: [], faktor: 1, fett: false };
  }
  const punkt = /^[-*+]\s+(.*)$/.exec(zeile);
  if (punkt) {
    return { art: 'punkt', stuecke: inlineStuecke(punkt[1]), faktor: 1, fett: false, marke: '-' };
  }
  const nummer = /^(\d+[.)])\s+(.*)$/.exec(zeile);
  if (nummer) {
    return {
      art: 'punkt',
      stuecke: inlineStuecke(nummer[2]),
      faktor: 1,
      fett: false,
      marke: nummer[1],
    };
  }
  return { art: 'absatz', stuecke: inlineStuecke(zeile), faktor: 1, fett: false };
}

/**
 * Vorlage in gesetzte Zeilen zerlegen. Leerzeilen verschwinden nicht, sie
 * werden zum Abstand des nächsten Blocks; führende Leerzeilen zählen nicht.
 */
export function parseMarkdown(markdown: string): MarkdownBlock[] {
  const bloecke: MarkdownBlock[] = [];
  let leerzeilen = 0;
  for (const rohZeile of markdown.replace(/\r\n?/g, '\n').split('\n')) {
    const zeile = rohZeile.trim();
    if (zeile === '') {
      leerzeilen += 1;
      continue;
    }
    bloecke.push({ ...blockAus(zeile), leerzeilenDavor: bloecke.length === 0 ? 0 : leerzeilen });
    leerzeilen = 0;
  }
  return bloecke;
}

/** Ein Platzhalter, wie ihn die App neben dem Eingabefeld anbietet. */
export interface Platzhalter {
  /** Name ohne Klammern, z. B. `Vorname` für `<Vorname>`. */
  name: string;
  beschreibung: string;
}

/** Platzhalter, die in jedem Schreiben zur Verfügung stehen. */
const PERSON_PLATZHALTER: Platzhalter[] = [
  { name: 'Vorname', beschreibung: 'Vorname der Person' },
  { name: 'Nachname', beschreibung: 'Nachname der Person' },
  { name: 'Matrikelnummer', beschreibung: 'Matrikelnummer' },
  { name: 'E-Mail', beschreibung: 'E-Mail-Adresse aus dem Stud.IP-Export' },
];

/** Platzhalter der Zulassungs-PDFs aus Schritt 2. */
export const PLATZHALTER_ZULASSUNG: Platzhalter[] = PERSON_PLATZHALTER;

/** Platzhalter der Sitzplatz-PDFs aus Schritt 4. */
export const PLATZHALTER_SITZPLATZ: Platzhalter[] = [
  ...PERSON_PLATZHALTER,
  { name: 'Raum', beschreibung: 'Raum der Prüfung, z. B. 94/E03' },
  { name: 'Sitzplatznummer', beschreibung: 'Nummer des zugeteilten Platzes' },
  { name: 'Zeit', beschreibung: 'Reservierte Zeit des Raums (Datum, Gruppe, Einlass)' },
];

/** Anfangstext der Zulassungs-PDFs (Schritt 2). */
export const VORLAGE_ZULASSUNG = `# Klausurzulassung

Dies ist eine automatisch generierte Datei und soll Sie darüber informieren, dass Sie <Vorname> <Nachname> <Matrikelnummer> <E-Mail> zur Klausur zugelassen sind.
`;

/** Anfangstext der Sitzplatz-PDFs (Schritt 4). */
export const VORLAGE_SITZPLATZ = `## Klausur Information

Liebe/r <Vorname>,

Sie haben sich für die Klausur angemeldet. Bitte beachten Sie folgende Informationen:
- Um an der Prüfung teilnehmen zu können, müssen Sie unbedingt Ihr Stud.IP-Login (User und Passwort) auswendig wissen.
Tipp: Passen Sie Ihr Passwort ggf. vor der Prüfung temporär so an, dass Sie es sich sicher merken können.
- Bitte halten Sie zu Beginn und während der Prüfung Ihren Studierendenausweis / Ihre Immatrikulationsbescheinigung (und ggf. den EXA-Anmeldenachweis) bereit.
- Bitte kommen Sie mit etwas zeitlichem Vorlauf zum Prüfungsraum und planen Sie am Ende zusätzliche Zeit ein, da am Anfang etwas Zeit für Organisatorisches benötigt wird.

Datum / Gruppe / Zeiten:
<Zeit>

Raum:
<Raum>

# SITZPLATZNUMMER: <Sitzplatznummer>
`;

/**
 * Platzhalter ersetzen. Was nicht bekannt ist, bleibt stehen: Ein
 * `<Vornmae>` soll im PDF auffallen und nicht als Leerstelle durchgehen.
 */
export function fuelleVorlage(vorlage: string, werte: Record<string, string>): string {
  return vorlage.replace(/<([^<>\n]+)>/g, (ganz, name: string) => werte[name] ?? ganz);
}

/** Werte einer Zulassung für die Platzhalter der Vorlage. */
export function zulassungsWerte(zulassung: Zulassung): Record<string, string> {
  return {
    Vorname: zulassung.vorname,
    Nachname: zulassung.nachname,
    Matrikelnummer: zulassung.matrikelnummer,
    'E-Mail': zulassung.email,
  };
}

/** Werte eines Sitzplatzes für die Platzhalter der Vorlage. */
export function sitzplatzWerte(platz: Sitzplatz): Record<string, string> {
  return {
    Vorname: platz.vorname,
    Nachname: platz.nachname,
    Matrikelnummer: platz.matrikelnummer,
    'E-Mail': platz.email,
    Raum: platz.raum,
    Sitzplatznummer: String(platz.sitzplatznummer),
    Zeit: platz.reservierteZeit,
  };
}

/**
 * Beispielperson für die Vorschau im Vorlagen-Dialog – erfundene Daten, damit
 * auch ohne geladene Liste zu sehen ist, was aus den Platzhaltern wird.
 */
export const BEISPIEL_WERTE: Record<string, string> = {
  Vorname: 'Erwin',
  Nachname: 'Schrödinger',
  Matrikelnummer: '1000005',
  'E-Mail': 'erwin@test.de',
  Raum: '94/E03',
  Sitzplatznummer: '1021',
  Zeit: '03.03.2026 Gruppe 1: ca. 09:15 Uhr = Einlassstart / 09:30 Uhr (s.t.) = Einlassschluss (fix)',
};
