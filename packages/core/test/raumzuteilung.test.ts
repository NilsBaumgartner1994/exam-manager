import { lies, pfad } from './fixtures';
import {
  eindeutigeNamenspraefixe,
  erstelleRaumzuteilung,
  parseRaeume,
  parseSitzplaetze,
  sitzplaetzeToCsv,
  Zulassung,
} from '../src';

const TEILNEHMER: Zulassung[] = [
  { nachname: 'Archi', vorname: 'Archimedes', matrikelnummer: '1000001', email: 'archimedes@test.de' },
  { nachname: 'Darwin', vorname: 'Charles', matrikelnummer: '1000003', email: 'charles@test.de' },
  { nachname: 'Galilei', vorname: 'Galileo', matrikelnummer: '1000007', email: 'galileo@test.de' },
  { nachname: 'Hodgkin', vorname: 'Dorothy', matrikelnummer: '1000004', email: 'dorothy@test.de' },
  { nachname: 'Lamarr', vorname: 'Hedy', matrikelnummer: '1000008', email: 'hedy@test.de' },
  { nachname: 'Pascal', vorname: 'Blaise', matrikelnummer: '1000002', email: 'blaise@test.de' },
  { nachname: 'Schrödinger', vorname: 'Erwin', matrikelnummer: '1000005', email: 'erwin@test.de' },
];

describe('Raumzuteilung (Screen 4)', () => {
  const raeume = parseRaeume(lies(pfad.raeume));

  it('liest die Raumliste', () => {
    expect(raeume).toHaveLength(2);
    expect(raeume[0]).toMatchObject({ raum: '94/E01', plaetze: 4 });
  });

  it('verteilt alle 7 Teilnehmenden und vergibt Sitzplätze ab 1001', () => {
    const { sitzplaetze, ohnePlatz } = erstelleRaumzuteilung(TEILNEHMER, raeume, { modus: 'balanced' });
    expect(ohnePlatz).toHaveLength(0);
    expect(sitzplaetze).toHaveLength(7);
    expect(sitzplaetze.map((s) => s.sitzplatznummer)).toEqual([1001, 1002, 1003, 1004, 1005, 1006, 1007]);
    // Innerhalb eines Raums alphabetisch nach Nachname
    const raum1 = sitzplaetze.filter((s) => s.raum === '94/E01').map((s) => s.nachname);
    expect(raum1).toEqual([...raum1].sort());
  });

  it('respektiert eine andere Start-Sitzplatznummer', () => {
    const { sitzplaetze } = erstelleRaumzuteilung(TEILNEHMER, raeume, {
      modus: 'sequential',
      ersteSitzplatznummer: 1,
    });
    expect(sitzplaetze[0].sitzplatznummer).toBe(1);
  });

  it('meldet Teilnehmende ohne Platz, wenn die Räume voll sind', () => {
    const klein = [{ ...raeume[0], plaetze: 2 }];
    const { sitzplaetze, ohnePlatz } = erstelleRaumzuteilung(TEILNEHMER, klein, { modus: 'balanced' });
    expect(sitzplaetze).toHaveLength(2);
    expect(ohnePlatz).toHaveLength(5);
  });

  it('erzeugt eindeutige Namenspräfixe für den Aushang', () => {
    const praefixe = eindeutigeNamenspraefixe(TEILNEHMER);
    const werte = [...praefixe.values()];
    expect(new Set(werte).size).toBe(werte.length);
    expect(praefixe.get(TEILNEHMER[0])).toBe('A'); // Archi ist eindeutig ab "A"... 
  });

  it('schreibt und liest das CSV-Format des Python-Originals', () => {
    const { sitzplaetze } = erstelleRaumzuteilung(TEILNEHMER, raeume, { modus: 'balanced' });
    const wieder = parseSitzplaetze(sitzplaetzeToCsv(sitzplaetze));
    expect(wieder).toEqual(sitzplaetze);
  });

  it('liest das eingecheckte Beispiel-Sitzplan-CSV', () => {
    const sitzplaetze = parseSitzplaetze(lies(pfad.sitzplan));
    expect(sitzplaetze).toHaveLength(7);
    expect(sitzplaetze[0].sitzplatznummer).toBe(1001);
  });
});
