import { lies, pfad } from './fixtures';
import { erkenneRolle, projektVorlage, verzeichnis } from '../src';

/** Erste Zeile einer Datei – so übergibt es auch die App. */
const kopf = (text: string) => text.split('\n')[0];

describe('Projektordner: Dateien erkennen', () => {
  it('erkennt die echten Beispieldateien des Repos an ihrer Kopfzeile', () => {
    expect(erkenneRolle('irgendwo/Notenliste.csv', kopf(lies(pfad.notenliste)))).toBe('notenliste');
    expect(erkenneRolle('teilnehmer.csv', kopf(lies(pfad.studipExport)))).toBe('studipExport');
    expect(erkenneRolle('4_raum/raeume.csv', kopf(lies(pfad.raeume)))).toBe('raeume');
  });

  it('unterscheidet Raumliste, Raumschema und Belegung an der Kopfzeile', () => {
    expect(erkenneRolle('x.csv', 'Raum;Plätze;ReservierteZeit')).toBe('raeume');
    expect(erkenneRolle('x.csv', 'Raum;94/E01')).toBe('raumschema');
    expect(erkenneRolle('x.csv', 'Raum;Zeile;Spalte;Sitzplatznummer')).toBe('raumbelegung');
  });

  it('nimmt den Dateinamen, wenn die Kopfzeile nichts hergibt', () => {
    expect(erkenneRolle('Zulassungen/swe++24_zulassungen.csv')).toBe('zulassungsbestand');
    expect(erkenneRolle('2_zulassungen/pv2025_zulassungen.csv', 'Nachname;Vorname;Matrikelnummer;E-Mail')).toBe('zulassungsbestand');
    expect(erkenneRolle('3_anmeldungen/check.xlsx')).toBe('hisExport');
    expect(erkenneRolle('allowedStudents.csv')).toBe('teilnehmer');
    expect(erkenneRolle('irgendwas.txt')).toBe('unbekannt');
  });

  it('lässt die Kopfzeile vor dem Dateinamen gelten', () => {
    // Heißt wie eine Teilnehmerliste, ist aber ein Stud.IP-Export.
    expect(erkenneRolle('teilnehmer.csv', '"Status";"Anrede";"Titel";"Vorname"')).toBe('studipExport');
  });

  it('stört sich nicht am BOM der VIPS-Notenliste', () => {
    expect(erkenneRolle('a.csv', '﻿Nachname;Vorname;Kennung;Matrikelnr.;PV - Aufgabenblatt 01')).toBe('notenliste');
  });

  it('liefert eine Vorlage, deren CSV-Kopfzeilen wieder erkannt werden', () => {
    const vorlage = projektVorlage();
    expect(vorlage.has('LIESMICH.md')).toBe(true);
    for (const [dateipfad, inhalt] of vorlage) {
      if (!dateipfad.endsWith('.csv')) continue;
      expect(erkenneRolle(dateipfad, kopf(inhalt))).not.toBe('unbekannt');
    }
  });

  it('kennt das Verzeichnis eines Pfads', () => {
    expect(verzeichnis('4_raum/raeume.csv')).toBe('4_raum');
    expect(verzeichnis('raeume.csv')).toBe('');
  });
});
