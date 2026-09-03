/**
 * Die Listen der Klausur: dieselben Spalten und dieselbe Sortierung, egal ob
 * daraus eine CSV-Datei wird oder eine gedruckte Tabelle.
 */
import {
  baueListe,
  dateiKennung,
  listeAlsCsv,
  listenDateien,
  parseRaeume,
  planeSitzplan,
  parseRaumschemata,
  Zulassung,
} from '../src';

const PERSONEN: Zulassung[] = [
  { nachname: 'Bohr', vorname: 'Niels', matrikelnummer: '1000002', email: 'b@test.de' },
  { nachname: 'Archi', vorname: 'Zeno', matrikelnummer: '1000009', email: 'z@test.de' },
  { nachname: 'Archi', vorname: 'Archimedes', matrikelnummer: '1000001', email: 'a@test.de' },
  { nachname: 'Curie', vorname: 'Marie', matrikelnummer: '1000003', email: 'c@test.de' },
];

/** Zwei Räume mit je zwei Tischen, gleichmäßig gefüllt. */
const SCHEMATA = parseRaumschemata('Raum;A\nT;T\nRaum;B\nT;T\n');
const RAEUME = parseRaeume('Raum;ReservierteZeit\nA;09:00\nB;09:00\n');

const { sitzplaetze } = planeSitzplan(PERSONEN, RAEUME, SCHEMATA, [], {
  fuellung: 'gleichmaessig',
});

describe('Listen', () => {
  it('nimmt in die Teilnehmendenliste alle Angaben auf', () => {
    const liste = baueListe('teilnehmer', sitzplaetze, RAEUME);
    expect(liste.spalten.map((s) => s.titel)).toEqual([
      'Anfang Nachname',
      'Sitzplatznummer',
      'Zeit und Raum',
      'Matrikelnummer',
      'Anwesend',
      'Nachname',
      'Vorname',
      'E-Mail',
    ]);
    expect(liste.abschnitte).toHaveLength(1);
    expect(liste.abschnitte[0].zeilen).toHaveLength(4);
    // Nach Sitzplatznummer sortiert.
    const nummern = liste.abschnitte[0].zeilen.map((z) => z.sitzplatznummer);
    expect(nummern).toEqual([...nummern].sort((a, b) => Number(a) - Number(b)));
  });

  it('sortiert die Liste für den Einlass nach Nachname und dann Vorname', () => {
    const liste = baueListe('tutoren', sitzplaetze, RAEUME);
    expect(liste.abschnitte[0].zeilen.map((z) => `${z.nachname}, ${z.vorname}`)).toEqual([
      'Archi, Archimedes',
      'Archi, Zeno',
      'Bohr, Niels',
      'Curie, Marie',
    ]);
  });

  it('gibt der Aufsicht je Raumeinsatz einen eigenen Abschnitt und eine eigene Datei', () => {
    const liste = baueListe('aufsicht', sitzplaetze, RAEUME);
    expect(liste.abschnitte.map((a) => a.titel)).toEqual(['A', 'B']);
    expect(liste.jeAbschnittEineDatei).toBe(true);
    const dateien = listenDateien(liste);
    expect([...dateien.keys()]).toEqual(['aufsichtsliste_A.csv', 'aufsichtsliste_B.csv']);
    // In jeder Datei stehen nur die Personen dieses Raums.
    expect(dateien.get('aufsichtsliste_A.csv')?.trim().split('\n')).toHaveLength(3);
  });

  it('sortiert den Aushang nach dem Namenskürzel', () => {
    const liste = baueListe('aushang', sitzplaetze, RAEUME);
    const kuerzel = liste.abschnitte[0].zeilen.map((z) => String(z.anfangNachname));
    expect(kuerzel).toEqual([...kuerzel].sort((a, b) => a.localeCompare(b, 'de')));
  });

  it('schreibt die CSV mit den Überschriften der Spalten', () => {
    const csv = listeAlsCsv(baueListe('aushang', sitzplaetze, RAEUME));
    expect(csv.split('\n')[0]).toBe('Anfang Nachname;Sitzplatznummer;Zeit und Raum');
    expect(csv.trim().split('\n')).toHaveLength(5);
  });

  it('macht aus einem Raumschlüssel einen Dateinamen', () => {
    expect(dateiKennung('94/E01')).toBe('94_E01');
    expect(dateiKennung('94/E01 (2. Durchgang)')).toBe('94_E01_2_Durchgang');
  });
});
