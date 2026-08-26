/**
 * Projektordner: alle Dateien einer Klausur an einem Ort.
 *
 * Wer den Ordner in der App auswählt, muss in den einzelnen Schritten nichts
 * mehr einzeln hochladen – die App erkennt an Dateiname und Kopfzeile, was
 * welche Datei ist. Der Kopfzeilen-Test geht vor: Dateinamen sind in der
 * Praxis uneinheitlich (`teilnehmer.csv` ist mal ein Stud.IP-Export, mal eine
 * Teilnehmerliste), die Kopfzeilen der Exporte dagegen eindeutig.
 */

export type DateiRolle =
  /** VIPS-Notenliste des Semesters. */
  | 'notenliste'
  /** Stud.IP-Teilnehmendenexport der Veranstaltung. */
  | 'studipExport'
  /** Zulassungsliste eines Jahres (Bestand, `*zulassungen*.csv`). */
  | 'zulassungsbestand'
  /** Anmeldungen des Prüfungsamts (HIS-Export, Excel). */
  | 'hisExport'
  /** Raumliste `Raum;Plätze;ReservierteZeit`. */
  | 'raeume'
  /** Raster der Räume (Tische, Tür, Wand, Pult). */
  | 'raumschema'
  /** Wer an welchem Tisch sitzt. */
  | 'raumbelegung'
  /** Klausur-Teilnehmende aus Schritt 3. */
  | 'teilnehmer'
  /** Sitzplan aus Schritt 4. */
  | 'sitzplan'
  | 'unbekannt';

/** Menschenlesbare Bezeichnung – für Anzeige und Statusmeldungen. */
export const ROLLEN_TITEL: Record<DateiRolle, string> = {
  notenliste: 'VIPS-Notenliste',
  studipExport: 'Stud.IP-Teilnehmendenexport',
  zulassungsbestand: 'Zulassungsliste',
  hisExport: 'HIS-Export (Anmeldungen)',
  raeume: 'Raumliste',
  raumschema: 'Raumschema',
  raumbelegung: 'Raumbelegung',
  teilnehmer: 'Klausur-Teilnehmende',
  sitzplan: 'Sitzplan',
  unbekannt: 'nicht zugeordnet',
};

function basisname(pfad: string): string {
  return pfad.split('/').pop() ?? pfad;
}

/** Verzeichnis eines Pfads ohne abschließenden Schrägstrich ('' = Wurzel). */
export function verzeichnis(pfad: string): string {
  const teile = pfad.split('/');
  teile.pop();
  return teile.join('/');
}

/**
 * Rolle einer Datei bestimmen. `kopf` ist die erste Zeile der Datei (bei
 * Textdateien) – damit lassen sich die Exporte sicher unterscheiden.
 */
export function erkenneRolle(pfad: string, kopf?: string): DateiRolle {
  const name = basisname(pfad).toLowerCase();

  // Binärformate: Der Excel-Export des Prüfungsamts ist die einzige Tabelle.
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) return 'hisExport';

  const kopfzeile = (kopf ?? '').replace(/^﻿/, '').trim();
  if (kopfzeile !== '') {
    const klein = kopfzeile.toLowerCase();
    if (klein.includes('"status"') || (klein.includes('status;') && klein.includes('anrede'))) {
      return 'studipExport';
    }
    if (klein.includes('aufgabenblatt') || klein.startsWith('nachname;vorname;kennung')) {
      return 'notenliste';
    }
    if (klein.startsWith('raum;zeile;spalte')) return 'raumbelegung';
    if (klein.startsWith('raum;plätze') || klein.startsWith('raum;plaetze')) return 'raeume';
    // Raumschema beginnt mit `Raum;<Name>` – Name statt Spaltenüberschriften.
    if (klein.startsWith('raum;')) return 'raumschema';
    if (klein.startsWith('anfang_nachname;sitzplatznummer')) return 'sitzplan';
  }

  // Dateiname als Rückfallebene (Konvention des Repos).
  if (name.includes('zulassungen')) return 'zulassungsbestand';
  if (name.includes('raumschema')) return 'raumschema';
  if (name.includes('raumbelegung')) return 'raumbelegung';
  if (name.includes('raeume') || name.includes('räume')) return 'raeume';
  if (name.includes('notenliste')) return 'notenliste';
  if (name.includes('teilnehmendenexport') || name.includes('studip')) return 'studipExport';
  if (name.includes('sitzplan') || name.includes('zuordnung')) return 'sitzplan';
  if (name.includes('allowedstudents') || name.includes('teilnehmer') || name === 'result.csv') {
    return 'teilnehmer';
  }
  return 'unbekannt';
}

/**
 * Ordner des Projekts. Aufbewahrt wird nur, was über eine Klausur hinaus
 * gebraucht wird: der Zulassungsbestand der vergangenen Jahre und die leeren
 * Raumraster, die sich für jeden Sitzplan wiederverwenden lassen.
 *
 * Alles andere (HIS-Export, Notenliste, Teilnehmendenliste, Belegung,
 * Sitzplan) gehört zu genau einer Klausur: Es wird im Schritt hochgeladen und
 * dort wieder heruntergeladen, aber nicht im Projektordner abgelegt.
 */
export const PROJEKT_ORDNER: Partial<Record<DateiRolle, string>> = {
  zulassungsbestand: 'Zulassungen',
  raeume: 'Raeume',
  raumschema: 'Raeume',
};

/** Gehört eine Datei dieser Rolle in den Projektordner (und damit ins ZIP)? */
export function gehoertInsProjekt(rolle: DateiRolle): boolean {
  return PROJEKT_ORDNER[rolle] !== undefined;
}

const LIESMICH = `# Klausur-Projektordner

Diesen Ordner in der Startseite des Exam Managers auswählen – die App erkennt
die Dateien an Name und Kopfzeile und füllt die Schritte damit. Alles bleibt
dabei auf dem eigenen Rechner.

Der Ordner hält nur das, was über eine einzelne Klausur hinaus gilt:

| Ordner | Datei | Was drinsteht |
|---|---|---|
| Zulassungen/ | *_zulassungen.csv | je Jahr eine Liste der Zugelassenen; der Dateiname muss "zulassungen" enthalten (z. B. \`pv2025_zulassungen.csv\`) |
| Raeume/ | raumschema.csv | leeres Raster der Räume (Tische, Tür, Wand, Pult) – ohne Studierende, für jeden Sitzplan wiederverwendbar |
| Raeume/ | raeume.csv | Räume mit Plätzen und reservierter Zeit |

Alles andere gehört zu genau einer Klausur und wird nicht hier abgelegt:
Notenliste und Stud.IP-Export, der HIS-Export des Prüfungsamts (\`check.xlsx\`),
die Liste der Klausur-Teilnehmenden, die Raumbelegung und der Sitzplan. Diese
Dateien lädt man im jeweiligen Schritt hoch und das Ergebnis dort wieder
herunter.

## Bearbeiteten Stand sichern

Auf der Startseite lässt sich der Projektordner als ZIP herunterladen – mit
den Zulassungslisten und Raumrastern, so wie sie nach dem Durchlauf aussehen.
Dessen Inhalt ersetzt dann diesen Ordner; die App schreibt nichts von selbst
auf die Festplatte.

## Keine echten Daten ins Repository

Dieser Ordner enthält Personendaten. Er gehört nicht in ein öffentliches
Repository.
`;

/**
 * Leere Projektvorlage: Pfad → Inhalt. Die CSV-Dateien enthalten nur ihre
 * Kopfzeile, damit Format und Trennzeichen von Anfang an stimmen.
 */
export function projektVorlage(): Map<string, string> {
  return new Map<string, string>([
    ['LIESMICH.md', LIESMICH],
    ['Zulassungen/veranstaltung_jahr_zulassungen.csv', 'Nachname;Vorname;Matrikelnummer;E-Mail\n'],
    ['Raeume/raeume.csv', 'Raum;Plätze;ReservierteZeit\n'],
    ['Raeume/raumschema.csv', 'Raum;Beispielraum\nP;.;.;.\n.;T;.;T\n.;T;.;T\nD;.;.;.\n'],
  ]);
}
