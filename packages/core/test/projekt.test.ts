import { readdirSync, readFileSync, statSync } from 'fs';
import { join, sep } from 'path';
import { lies, pfad } from './fixtures';
import {
  DateiRolle,
  erkenneRolle,
  gehoertInsProjekt,
  PROJEKT_ORDNER,
  PROJEKT_SCHEMA,
  projektPfad,
  projektVorlage,
  verzeichnis,
} from '../src';

/** Erste Zeile einer Datei – so übergibt es auch die App. */
const kopf = (text: string) => text.split('\n')[0];

const BEISPIELPROJEKT = join(__dirname, '..', '..', '..', 'Beispielprojekt');

/** Alle Dateien unter `wurzel`, als Pfade relativ dazu (mit `/`). */
function alleDateien(wurzel: string, unter = ''): string[] {
  const voll = join(wurzel, unter);
  return readdirSync(voll).flatMap((name) => {
    const kind = unter === '' ? name : `${unter}/${name}`;
    return statSync(join(wurzel, kind)).isDirectory()
      ? alleDateien(wurzel, kind)
      : [kind.split(sep).join('/')];
  });
}

describe('Projektordner: Dateien erkennen', () => {
  it('erkennt die Beispieldateien an ihrem Ordner und ihrer Kopfzeile', () => {
    expect(
      erkenneRolle('0_Input_Vips_Notenliste/Notenliste.csv', kopf(lies(pfad.notenliste))),
    ).toBe('notenliste');
    expect(
      erkenneRolle(
        '0_Input_Kurs_Teilnehmer_Studip_Liste/teilnehmer.csv',
        kopf(lies(pfad.studipExport)),
      ),
    ).toBe('studipExport');
    expect(erkenneRolle('Raeume/raeume.csv', kopf(lies(pfad.raeume)))).toBe('raeume');
    expect(erkenneRolle('0_Input_Klausuranmeldungen/check.xlsx')).toBe('hisExport');
    expect(erkenneRolle('Zulassungen/pv2025_zulassungen.csv')).toBe('zulassungsbestand');
    expect(erkenneRolle('2_Zulassungs_PDFs_Export/1000001.pdf')).toBe('zulassungsPdf');
    expect(erkenneRolle('3_Klausur_Teilnehmende_Export/allowedStudents.csv')).toBe('teilnehmer');
  });

  it('nimmt nur, was im vorgesehenen Ordner liegt', () => {
    // Dieselbe Datei, am falschen Platz: wird nicht angefasst.
    expect(erkenneRolle('Notenliste.csv', kopf(lies(pfad.notenliste)))).toBe('unbekannt');
    expect(erkenneRolle('Zulassungen/Notenliste.csv', kopf(lies(pfad.notenliste)))).toBe(
      'unbekannt',
    );
    expect(erkenneRolle('check.xlsx')).toBe('unbekannt');
    expect(erkenneRolle('Raeume/unterordner/raeume.csv', 'Raum;Plätze;ReservierteZeit')).toBe(
      'unbekannt',
    );
  });

  it('verlangt in Zulassungen/ den Dateinamen *zulassungen*.csv', () => {
    expect(erkenneRolle('Zulassungen/swe++24_zulassungen.csv')).toBe('zulassungsbestand');
    expect(erkenneRolle('Zulassungen/check.csv')).toBe('unbekannt');
    expect(erkenneRolle('Zulassungen/pv2025_zulassungen.xlsx')).toBe('unbekannt');
  });

  it('achtet auf die Endung des Ordners', () => {
    expect(erkenneRolle('0_Input_Klausuranmeldungen/anmeldungen.csv')).toBe('unbekannt');
    expect(erkenneRolle('0_Input_Vips_Notenliste/noten.xlsx')).toBe('unbekannt');
    expect(erkenneRolle('2_Zulassungs_PDFs_Export/liste.csv')).toBe('unbekannt');
  });

  it('unterscheidet Raumliste und Raumschema in Raeume/ an der Kopfzeile', () => {
    expect(erkenneRolle('Raeume/x.csv', 'Raum;Plätze;ReservierteZeit')).toBe('raeume');
    expect(erkenneRolle('Raeume/x.csv', 'Raum;94/E01')).toBe('raumschema');
  });

  it('unterscheidet Sitzplan und Belegung im Export-Ordner an der Kopfzeile', () => {
    expect(erkenneRolle('4_Raumzuteilung_Export/x.csv', 'Raum;Zeile;Spalte;Sitzplatznummer')).toBe(
      'raumbelegung',
    );
    expect(
      erkenneRolle('4_Raumzuteilung_Export/x.csv', 'Anfang_Nachname;Sitzplatznummer;Raum'),
    ).toBe('sitzplan');
  });

  it('stört sich nicht am BOM der VIPS-Notenliste', () => {
    expect(
      erkenneRolle(
        '0_Input_Vips_Notenliste/a.csv',
        '﻿Nachname;Vorname;Kennung;Matrikelnr.;PV - Aufgabenblatt 01',
      ),
    ).toBe('notenliste');
  });
});

describe('Projektordner: Schema', () => {
  it('gibt jeder Rolle genau einen Ordner', () => {
    expect(PROJEKT_ORDNER.notenliste).toBe('0_Input_Vips_Notenliste');
    expect(PROJEKT_ORDNER.studipExport).toBe('0_Input_Kurs_Teilnehmer_Studip_Liste');
    expect(PROJEKT_ORDNER.hisExport).toBe('0_Input_Klausuranmeldungen');
    expect(PROJEKT_ORDNER.zulassungsbestand).toBe('Zulassungen');
    expect(PROJEKT_ORDNER.raeume).toBe('Raeume');
    expect(PROJEKT_ORDNER.raumschema).toBe('Raeume');
    expect(PROJEKT_ORDNER.zulassungsPdf).toBe('2_Zulassungs_PDFs_Export');
    expect(PROJEKT_ORDNER.teilnehmer).toBe('3_Klausur_Teilnehmende_Export');
    expect(PROJEKT_ORDNER.sitzplan).toBe('4_Raumzuteilung_Export');
    expect(PROJEKT_ORDNER.raumbelegung).toBe('4_Raumzuteilung_Export');
    expect(gehoertInsProjekt('unbekannt')).toBe(false);
  });

  it('nennt jeden Ordner nur einmal', () => {
    const ordner = PROJEKT_SCHEMA.map((regel) => regel.ordner);
    expect(new Set(ordner).size).toBe(ordner.length);
  });

  it('legt Ergebnisse im Ordner ihrer Rolle ab – und erkennt sie dort wieder', () => {
    const rollen: DateiRolle[] = ['zulassungsbestand', 'teilnehmer', 'zulassungsPdf'];
    const namen = ['pv2026_zulassungen.csv', 'allowedStudents.csv', '1000001.pdf'];
    rollen.forEach((rolle, i) => {
      const ziel = projektPfad(rolle, namen[i]);
      expect(verzeichnis(ziel)).toBe(PROJEKT_ORDNER[rolle]);
      expect(erkenneRolle(ziel)).toBe(rolle);
    });
  });

  it('liefert eine Vorlage, deren Ordner und CSV-Kopfzeilen wieder passen', () => {
    const vorlage = projektVorlage();
    expect(vorlage.has('LIESMICH.md')).toBe(true);
    for (const regel of PROJEKT_SCHEMA) {
      expect(vorlage.has(`${regel.ordner}/LIESMICH.md`)).toBe(true);
    }
    for (const [dateipfad, inhalt] of vorlage) {
      if (!dateipfad.endsWith('.csv')) continue;
      expect(erkenneRolle(dateipfad, kopf(inhalt))).not.toBe('unbekannt');
    }
  });

  it('kennt das Verzeichnis eines Pfads', () => {
    expect(verzeichnis('Raeume/raeume.csv')).toBe('Raeume');
    expect(verzeichnis('raeume.csv')).toBe('');
  });
});

describe('Beispielprojekt/', () => {
  const dateien = alleDateien(BEISPIELPROJEKT);

  it('legt jede Beispieldatei in den Ordner, in dem die App sie sucht', () => {
    const rollen = new Map<string, DateiRolle>();
    for (const datei of dateien) {
      if (datei.endsWith('.md')) continue; // erklärende LIESMICH-Dateien
      const inhalt = datei.endsWith('.csv')
        ? readFileSync(join(BEISPIELPROJEKT, datei), 'utf-8').split('\n')[0]
        : undefined;
      rollen.set(datei, erkenneRolle(datei, inhalt));
    }
    expect([...rollen.values()]).not.toContain('unbekannt');
    // Die drei Eingaben, die ein Durchlauf braucht, liegen bereit.
    const gefunden = new Set(rollen.values());
    for (const rolle of ['hisExport', 'studipExport', 'notenliste', 'zulassungsbestand', 'raeume', 'raumschema'] as const) {
      expect(gefunden).toContain(rolle);
    }
  });

  it('hat für jeden Ordner des Schemas einen Ordner', () => {
    const ordner = new Set(dateien.map((datei) => verzeichnis(datei)));
    for (const regel of PROJEKT_SCHEMA) {
      expect(ordner).toContain(regel.ordner);
    }
  });

  it('enthält keine erzeugten PDFs (Personendaten)', () => {
    expect(dateien.filter((datei) => datei.endsWith('.pdf'))).toEqual([]);
  });
});
