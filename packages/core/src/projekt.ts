/**
 * Projektordner: alle Dateien einer Klausur an einem Ort.
 *
 * Der Ordner hat ein festes Schema (`PROJEKT_SCHEMA`): Jede Rolle hat genau
 * einen Ordner, und **nur** was dort mit der passenden Endung liegt, wird
 * eingelesen. Eine Notenliste im Hauptordner oder ein Stud.IP-Export in
 * `Zulassungen/` gilt bewusst als „nicht zugeordnet“ – lieber eine Datei
 * sichtbar ignorieren als die falsche Datei stillschweigend auswerten.
 *
 * Die Kopfzeile entscheidet nur noch dort, wo ein Ordner mehrere Rollen
 * aufnimmt (`Raeume/` hält Raumliste und Raumschema).
 */

import { VORLAGE_SITZPLATZ, VORLAGE_ZULASSUNG } from './pdfVorlage';

export type DateiRolle =
  /** VIPS-Notenliste des Semesters. */
  | 'notenliste'
  /** Stud.IP-Teilnehmendenexport der Veranstaltung. */
  | 'studipExport'
  /** Zulassungsliste eines Jahres (Bestand, `*_zulassungen.csv`). */
  | 'zulassungsbestand'
  /** Anmeldungen des Prüfungsamts (HIS-Export, Excel). */
  | 'hisExport'
  /** Raumliste `Raum;Plätze;ReservierteZeit` – der Bestand des Hauses. */
  | 'raeume'
  /** Räume, die **diese** Klausur benutzt (ein Raum darf mehrfach vorkommen). */
  | 'klausurraeume'
  /** Raster eines Raums (Tische, Tür, Wand, Pult) – je Raum eine Datei. */
  | 'raumschema'
  /** Wer an welchem Tisch sitzt. */
  | 'raumbelegung'
  /** Klausur-Teilnehmende aus Schritt 3. */
  | 'teilnehmer'
  /** Sitzplan aus Schritt 4. */
  | 'sitzplan'
  /** Erzeugte Zulassungs-PDFs aus Schritt 2 (je Matrikelnummer eines). */
  | 'zulassungsPdf'
  /** Markdown-Vorlage für die Schreiben an Studierende (Schritt 2 und 4). */
  | 'pdfVorlage'
  | 'unbekannt';

/** Menschenlesbare Bezeichnung – für Anzeige und Statusmeldungen. */
export const ROLLEN_TITEL: Record<DateiRolle, string> = {
  notenliste: 'VIPS-Notenliste',
  studipExport: 'Stud.IP-Teilnehmendenexport',
  zulassungsbestand: 'Zulassungsliste',
  hisExport: 'Klausuranmeldungen (HIS-Export)',
  raeume: 'Raumliste',
  klausurraeume: 'Räume dieser Klausur',
  raumschema: 'Raumschema',
  raumbelegung: 'Raumbelegung',
  teilnehmer: 'Klausur-Teilnehmende',
  sitzplan: 'Sitzplan',
  zulassungsPdf: 'Zulassungs-PDF',
  pdfVorlage: 'PDF-Vorlage',
  unbekannt: 'nicht zugeordnet',
};

/** Eine Regel des Ordnerschemas: welcher Ordner nimmt was auf. */
export interface OrdnerRegel {
  /** Ordner innerhalb des Projekts, ohne Schrägstriche. */
  ordner: string;
  /** Zulässige Endungen (klein geschrieben, mit Punkt). */
  endungen: string[];
  /** Muss im Dateinamen vorkommen (klein geschrieben); leer = beliebig. */
  nameEnthaelt?: string;
  /**
   * Rollen dieses Ordners. Bei mehreren entscheidet die Kopfzeile, die erste
   * ist der Rückfall.
   */
  rollen: DateiRolle[];
  /** Wofür der Ordner da ist – für LIESMICH und Anzeige in der App. */
  zweck: string;
}

/**
 * Das Schema des Projektordners. Die Nummern folgen den Schritten der App:
 * `0_Input_…` sind die Dateien, die von außen kommen (Prüfungsamt, Stud.IP,
 * VIPS), die nummerierten Export-Ordner nehmen die Ergebnisse der Schritte
 * auf. `Zulassungen/` und `Raeume/` sind unnummeriert, weil sie über eine
 * einzelne Klausur hinaus gelten.
 */
export const PROJEKT_SCHEMA: OrdnerRegel[] = [
  {
    ordner: '0_Input_Klausuranmeldungen',
    endungen: ['.xlsx', '.xls'],
    rollen: ['hisExport'],
    zweck: 'Anmeldungen zur Klausur, wie sie das Prüfungsamt schickt (Excel).',
  },
  {
    ordner: '0_Input_Kurs_Teilnehmer_Studip_Liste',
    endungen: ['.csv'],
    rollen: ['studipExport'],
    zweck: 'Teilnehmendenexport der Veranstaltung aus Stud.IP.',
  },
  {
    ordner: '0_Input_Vips_Notenliste',
    endungen: ['.csv'],
    rollen: ['notenliste'],
    zweck: 'Notenliste aus VIPS mit den Punkten der Aufgabenblätter.',
  },
  {
    ordner: 'Zulassungen',
    endungen: ['.csv'],
    nameEnthaelt: 'zulassungen',
    rollen: ['zulassungsbestand'],
    zweck: 'Je Jahr eine Liste der Zugelassenen, z. B. pv2025_zulassungen.csv.',
  },
  {
    ordner: 'Raeume',
    endungen: ['.csv'],
    rollen: ['raeume', 'raumschema'],
    zweck:
      'Bestand des Hauses: Raumliste (raeume.csv) und je Raum eine Raster-Datei (94_E01.csv) – ohne Studierende, jedes Jahr wiederverwendbar.',
  },
  {
    ordner: 'Vorlagen',
    endungen: ['.md'],
    nameEnthaelt: 'vorlage',
    rollen: ['pdfVorlage'],
    zweck:
      'Text der Schreiben an Studierende als Markdown mit Platzhaltern (zulassung_vorlage.md, sitzplatz_vorlage.md) – in der App über „Text anpassen“ zu bearbeiten.',
  },
  {
    ordner: '2_Zulassungs_PDFs_Export',
    endungen: ['.pdf'],
    rollen: ['zulassungsPdf'],
    zweck: 'Erzeugte Zulassungs-PDFs, je Matrikelnummer eines (Schritt 2).',
  },
  {
    ordner: '3_Klausur_Teilnehmende_Export',
    endungen: ['.csv'],
    rollen: ['teilnehmer'],
    zweck:
      'Angemeldete mit und ohne Zulassung (Schritt 3). Optional – ohne diesen Export prüft Schritt 4 die Anmeldungen selbst.',
  },
  {
    ordner: '4_Raumzuteilung_Export',
    endungen: ['.csv'],
    rollen: ['sitzplan', 'raumbelegung', 'klausurraeume'],
    zweck:
      'Räume dieser Klausur, Sitzplan und Raumbelegung (Schritt 4). Ein Raum darf in klausurraeume.csv mehrfach stehen – dann wird er mehrfach belegt.',
  },
];

/** Rolle → Ordner, aus dem Schema abgeleitet. */
export const PROJEKT_ORDNER: Partial<Record<DateiRolle, string>> = Object.fromEntries(
  PROJEKT_SCHEMA.flatMap((regel) => regel.rollen.map((rolle) => [rolle, regel.ordner])),
) as Partial<Record<DateiRolle, string>>;

/**
 * Kurzform, wie die Dateien einer Rolle im Projekt heißen –
 * z. B. `Zulassungen/*zulassungen*.csv`.
 *
 * Wo ein Schritt **alle** Dateien einer Rolle verwendet, ist die Aufzählung
 * der einzelnen Pfade nur Rauschen: Bei knapp zwanzig Jahreslisten füllt sie
 * den halben Bildschirm, ohne mehr zu sagen als das Muster in einer Zeile.
 */
export function dateiMuster(rolle: DateiRolle): string {
  const regel = PROJEKT_SCHEMA.find((eintrag) => eintrag.rollen.includes(rolle));
  if (regel === undefined) return '';
  const name = regel.nameEnthaelt === undefined ? '*' : `*${regel.nameEnthaelt}*`;
  return `${regel.ordner}/${regel.endungen.map((endung) => `${name}${endung}`).join(', ')}`;
}

/** Dateiname der Vorlage für die Zulassungs-PDFs (Schritt 2). */
export const VORLAGE_NAME_ZULASSUNG = 'zulassung_vorlage.md';

/** Dateiname der Vorlage für die Sitzplatz-PDFs (Schritt 4). */
export const VORLAGE_NAME_SITZPLATZ = 'sitzplatz_vorlage.md';

/** Pfad der Zulassungs-Vorlage im Projekt. */
export const VORLAGE_DATEI_ZULASSUNG = projektPfad('pdfVorlage', VORLAGE_NAME_ZULASSUNG);

/** Pfad der Sitzplatz-Vorlage im Projekt. */
export const VORLAGE_DATEI_SITZPLATZ = projektPfad('pdfVorlage', VORLAGE_NAME_SITZPLATZ);

function basisname(pfad: string): string {
  return pfad.split('/').pop() ?? pfad;
}

/** Verzeichnis eines Pfads ohne abschließenden Schrägstrich ('' = Wurzel). */
export function verzeichnis(pfad: string): string {
  const teile = pfad.split('/');
  teile.pop();
  return teile.join('/');
}

/** Regel des Ordners, in dem der Pfad liegt (undefined = kein Schema-Ordner). */
export function regelFuerPfad(pfad: string): OrdnerRegel | undefined {
  const ordner = verzeichnis(pfad).toLowerCase();
  return PROJEKT_SCHEMA.find((regel) => regel.ordner.toLowerCase() === ordner);
}

/**
 * Rolle unter mehreren Kandidaten an der Kopfzeile festmachen. Greift nur in
 * Ordnern, die mehr als eine Rolle aufnehmen.
 */
function rolleAusKopf(kopf: string | undefined, kandidaten: DateiRolle[]): DateiRolle {
  const kopfzeile = (kopf ?? '').replace(/^﻿/, '').trim().toLowerCase();
  const passt = (rolle: DateiRolle) => kandidaten.includes(rolle);

  if (kopfzeile !== '') {
    if (passt('raumbelegung') && kopfzeile.startsWith('raum;zeile;spalte')) return 'raumbelegung';
    // Dieselbe Kopfzeile, zwei Bedeutungen: In `Raeume/` steht der Bestand des
    // Hauses, im Export-Ordner die Räume dieser einen Klausur.
    if (kopfzeile.startsWith('raum;plätze') || kopfzeile.startsWith('raum;plaetze')) {
      if (passt('klausurraeume')) return 'klausurraeume';
      if (passt('raeume')) return 'raeume';
    }
    // Raumschema beginnt mit `Raum;<Name>` – Name statt Spaltenüberschriften.
    if (passt('raumschema') && kopfzeile.startsWith('raum;')) return 'raumschema';
    if (passt('sitzplan') && kopfzeile.startsWith('anfang_nachname;sitzplatznummer')) {
      return 'sitzplan';
    }
  }
  return kandidaten[0];
}

/**
 * Rolle einer Datei bestimmen. `pfad` ist der Pfad **innerhalb** des
 * Projektordners, `kopf` die erste Zeile (bei Textdateien).
 *
 * Entscheidend ist der Ordner: Was nicht im vorgesehenen Ordner liegt oder
 * die falsche Endung hat, ist `unbekannt` und wird von den Schritten nicht
 * angefasst.
 */
export function erkenneRolle(pfad: string, kopf?: string): DateiRolle {
  const regel = regelFuerPfad(pfad);
  if (!regel) return 'unbekannt';

  const name = basisname(pfad).toLowerCase();
  if (!regel.endungen.some((endung) => name.endsWith(endung))) return 'unbekannt';
  if (regel.nameEnthaelt && !name.includes(regel.nameEnthaelt)) return 'unbekannt';

  return regel.rollen.length === 1 ? regel.rollen[0] : rolleAusKopf(kopf, regel.rollen);
}

/** Gehört eine Datei dieser Rolle in den Projektordner? */
export function gehoertInsProjekt(rolle: DateiRolle): boolean {
  return PROJEKT_ORDNER[rolle] !== undefined;
}

/** Pfad, unter dem ein Ergebnis dieser Rolle im Projekt abgelegt wird. */
export function projektPfad(rolle: DateiRolle, dateiname: string): string {
  const ordner = PROJEKT_ORDNER[rolle];
  return ordner === undefined ? dateiname : `${ordner}/${dateiname}`;
}

const LIESMICH = `# Klausur-Projektordner

Diesen Ordner in der Startseite des Exam Managers auswählen – die App liest
die Dateien aus den unten stehenden Ordnern und füllt die Schritte damit.
Alles bleibt dabei auf dem eigenen Rechner.

**Der Ordner entscheidet.** Eine Datei wird nur gelesen, wenn sie im
vorgesehenen Ordner mit der passenden Endung liegt; alles andere zeigt die App
als „nicht zugeordnet“ an und rührt es nicht an.

| Ordner | Dateien | Was hineingehört |
|---|---|---|
${PROJEKT_SCHEMA.map(
  (regel) =>
    `| ${regel.ordner}/ | ${regel.nameEnthaelt ? `*${regel.nameEnthaelt}*` : '*'}${regel.endungen.join(', *')} | ${regel.zweck} |`,
).join('\n')}

Die Export-Ordner füllt die App: Was ein Schritt erzeugt, landet dort im
Projektstand und ist in der ZIP enthalten, die sich auf jedem Screen über
„Aktuelles Projekt herunterladen“ speichern lässt.

## Bearbeiteten Stand sichern

Der Browser darf nicht in den gewählten Ordner zurückschreiben. Der Weg zurück
auf die Platte ist immer die ZIP: herunterladen, entpacken und den eigenen
Ordner damit ersetzen.

## Keine echten Daten ins Repository

Dieser Ordner enthält Personendaten. Er gehört nicht in ein öffentliches
Repository.
`;

/** Kurze LIESMICH-Datei je Ordner, damit die Struktur auch leer erklärt ist. */
function ordnerHinweis(regel: OrdnerRegel): string {
  const muster = `${regel.nameEnthaelt ? `*${regel.nameEnthaelt}*` : '*'}${regel.endungen.join(', *')}`;
  return `# ${regel.ordner}\n\n${regel.zweck}\n\nErkannt werden hier: \`${muster}\`\n`;
}

/**
 * Leere Projektvorlage: Pfad → Inhalt. Die CSV-Dateien enthalten nur ihre
 * Kopfzeile, damit Format und Trennzeichen von Anfang an stimmen; jeder Ordner
 * bekommt eine LIESMICH.md, damit er auch leer in der ZIP existiert.
 */
export function projektVorlage(): Map<string, string> {
  const vorlage = new Map<string, string>([['LIESMICH.md', LIESMICH]]);
  for (const regel of PROJEKT_SCHEMA) {
    vorlage.set(`${regel.ordner}/LIESMICH.md`, ordnerHinweis(regel));
  }
  vorlage.set(
    'Zulassungen/veranstaltung_jahr_zulassungen.csv',
    'Nachname;Vorname;Matrikelnummer;E-Mail\n',
  );
  vorlage.set('Raeume/raeume.csv', 'Raum;Plätze;ReservierteZeit\n');
  // Die Anfangstexte liegen als Dateien im Ordner: So ist auch ohne die App
  // zu sehen, was in den Schreiben steht und wo es geändert wird.
  vorlage.set(VORLAGE_DATEI_ZULASSUNG, VORLAGE_ZULASSUNG);
  vorlage.set(VORLAGE_DATEI_SITZPLATZ, VORLAGE_SITZPLATZ);
  // Je Raum eine Datei, benannt nach dem Raum – so ist im Ordner zu sehen,
  // welche Räume es gibt (`raumschemaDateiname`).
  vorlage.set(
    'Raeume/beispielraum.csv',
    'Raum;Beispielraum\nP;.;.;.\n.;T;.;T\n.;T;.;T\nD;.;.;.\n',
  );
  return vorlage;
}
