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
 * Ordner der Projektvorlage – hier landen auch neu erzeugte Dateien, wenn im
 * Projekt noch keine Datei derselben Rolle liegt.
 */
export const PROJEKT_ORDNER: Record<DateiRolle, string> = {
  notenliste: '1_vips',
  studipExport: '1_vips',
  zulassungsbestand: '2_zulassungen',
  hisExport: '3_anmeldungen',
  teilnehmer: '3_anmeldungen',
  raeume: '4_raum',
  raumschema: '4_raum',
  raumbelegung: '4_raum',
  sitzplan: '4_raum',
  unbekannt: '',
};

const LIESMICH = `# Klausur-Projektordner

Diesen Ordner in der Startseite des Exam Managers auswählen – die App erkennt
die Dateien an Name und Kopfzeile und füllt die Schritte damit. Alles bleibt
dabei auf dem eigenen Rechner.

## Was gehört wohin

| Ordner | Datei | Woher |
|---|---|---|
| 1_vips/ | Notenliste.csv | VIPS-Export der Punkte |
| 1_vips/ | Teilnehmendenexport.csv | Stud.IP-Export der Veranstaltung |
| 2_zulassungen/ | *zulassungen*.csv | je Jahr eine Liste; der Dateiname muss "zulassungen" enthalten |
| 3_anmeldungen/ | check.xlsx | Excel-Export des Prüfungsamts (HIS) |
| 3_anmeldungen/ | allowedStudents.csv | Ergebnis aus Schritt 3 (erzeugt die App) |
| 4_raum/ | raeume.csv | Räume mit Plätzen und Zeiten |
| 4_raum/ | raumschema.csv | Raster der Räume (Tische, Tür, Wand, Pult) |
| 4_raum/ | raumbelegung.csv | wer an welchem Tisch sitzt (erzeugt die App) |

## Bearbeiteten Stand sichern

Auf der Startseite lässt sich der aktuelle Stand als ZIP herunterladen. Dessen
Inhalt ersetzt dann diesen Ordner – die App schreibt nichts von selbst auf die
Festplatte.

## Keine echten Daten ins Repository

Dieser Ordner enthält Personendaten. Er gehört nicht in ein öffentliches
Repository.
`;

/**
 * Leere Projektvorlage: Pfad → Inhalt. Die CSV-Dateien enthalten nur ihre
 * Kopfzeile, damit Format und Trennzeichen von Anfang an stimmen.
 * `check.xlsx` fehlt bewusst – die Datei kommt aus dem Prüfungsamt.
 */
export function projektVorlage(): Map<string, string> {
  return new Map<string, string>([
    ['LIESMICH.md', LIESMICH],
    ['1_vips/Notenliste.csv', 'Nachname;Vorname;Kennung;Matrikelnr.;Aufgabenblatt 01;Summe\n'],
    [
      '1_vips/Teilnehmendenexport.csv',
      '"Status";"Anrede";"Titel";"Vorname";"Nachname";"Titel nachgestellt";"Benutzername";"Adresse";"Telefonnr.";"E-Mail";"Anmeldedatum";"Matrikelnummer";"Studiengänge";"Position"\n',
    ],
    ['2_zulassungen/jahr_zulassungen.csv', 'Nachname;Vorname;Matrikelnummer;E-Mail\n'],
    ['3_anmeldungen/HIER_check_xlsx_ablegen.txt', 'Den Excel-Export des Prüfungsamts (check.xlsx) in diesen Ordner legen.\n'],
    ['4_raum/raeume.csv', 'Raum;Plätze;ReservierteZeit\n'],
    ['4_raum/raumschema.csv', 'Raum;Beispielraum\nP;.;.;.\n.;T;.;T\n.;T;.;T\nD;.;.;.\n'],
  ]);
}
