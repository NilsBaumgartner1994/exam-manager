import { lies, liesRaumschemata, pfad } from './fixtures';
import {
  eindeutigeNamenspraefixe,
  einsatzRaster,
  erstelleRaumzuteilung,
  mitDurchgaengen,
  parseRaeume,
  parseRaumschemaDateien,
  parseRaumschemata,
  parseSitzplaetze,
  raumSchluessel,
  sitzplaetzeToCsv,
  sitzplatznummern,
  tischzellen,
  verteileAufRaumschemata,
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
    expect(raeume.map((r) => r.raum)).toEqual(['01/E01', '66/E33', '94/E01', '94/E03', '94/E06']);
    expect(raeume[0]).toMatchObject({ raum: '01/E01', plaetze: 193 });
  });

  it('hält Platzzahl und Raumschema des Beispieldatensatzes zusammen', () => {
    // Die Plätze eines Raums sind genau die Tische in seinem Raster – sonst
    // meldet die App Teilnehmende „ohne Tisch im Sitzplan“. Die Raster liegen
    // je Raum in einer eigenen Datei; zusammen ergeben sie alle Räume.
    const schemata = parseRaumschemaDateien(liesRaumschemata());
    expect(schemata.map((s) => s.raum)).toEqual(raeume.map((r) => r.raum));
    for (const raum of raeume) {
      const schema = schemata.find((s) => s.raum === raum.raum);
      expect(schema).toBeDefined();
      expect(tischzellen(schema!)).toHaveLength(raum.plaetze);
    }
  });

  it('verteilt alle 7 Teilnehmenden und vergibt Sitzplätze ab 1001', () => {
    const { sitzplaetze, ohnePlatz } = erstelleRaumzuteilung(TEILNEHMER, raeume, { modus: 'balanced' });
    expect(ohnePlatz).toHaveLength(0);
    expect(sitzplaetze).toHaveLength(7);
    expect(sitzplaetze.map((s) => s.sitzplatznummer)).toEqual([1001, 1002, 1003, 1004, 1005, 1006, 1007]);
    // Innerhalb eines Raums alphabetisch nach Nachname
    const raum1 = sitzplaetze.filter((s) => s.raum === '01/E01').map((s) => s.nachname);
    expect(raum1.length).toBeGreaterThan(1);
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

describe('Derselbe Raum mehrfach (zwei Durchgänge)', () => {
  const ZWEI_DURCHGAENGE = parseRaeume(
    'Raum;Plätze;ReservierteZeit\n' +
      '94/E01;2;01.02.2026 Gruppe 1\n' +
      '94/E01;2;01.02.2026 Gruppe 2\n',
  );

  it('zählt beim Einlesen die Durchgänge durch', () => {
    expect(ZWEI_DURCHGAENGE.map((r) => r.durchgang)).toEqual([1, 2]);
    expect(ZWEI_DURCHGAENGE.map(raumSchluessel)).toEqual(['94/E01', '94/E01 (2. Durchgang)']);
  });

  it('zählt auch eine von Hand zusammengestellte Liste durch', () => {
    const liste = mitDurchgaengen([
      { raum: '94/E01', plaetze: 2, reservierteZeit: 'Gruppe 1' },
      { raum: '94/E03', plaetze: 2, reservierteZeit: 'Gruppe 1' },
      { raum: '94/E01', plaetze: 2, reservierteZeit: 'Gruppe 2' },
    ]);
    expect(liste.map((r) => r.durchgang)).toEqual([1, 1, 2]);
  });

  it('behandelt jeden Durchgang als eigenen Raum mit eigenen Plätzen', () => {
    const { sitzplaetze, ohnePlatz } = erstelleRaumzuteilung(TEILNEHMER.slice(0, 4), ZWEI_DURCHGAENGE, {
      modus: 'sequential',
    });
    expect(ohnePlatz).toHaveLength(0);
    // Beide Durchgänge heißen im Aushang gleich – auseinander hält sie der
    // Schlüssel und die reservierte Zeit.
    expect(new Set(sitzplaetze.map((s) => s.raum))).toEqual(new Set(['94/E01']));
    expect(new Set(sitzplaetze.map((s) => s.raumSchluessel))).toEqual(
      new Set(['94/E01', '94/E01 (2. Durchgang)']),
    );
    expect(sitzplaetze.filter((s) => s.raumSchluessel === '94/E01')).toHaveLength(2);
  });

  it('gibt jedem Durchgang eigene Tische, eigene Belegung und eigene Nummern', () => {
    const schema = parseRaumschemata('Raum;94/E01\nT;T\n')[0];
    const raster = einsatzRaster(ZWEI_DURCHGAENGE, [schema]);
    expect(raster.map((r) => r.raum)).toEqual(['94/E01', '94/E01 (2. Durchgang)']);

    const { sitzplaetze } = erstelleRaumzuteilung(TEILNEHMER.slice(0, 4), ZWEI_DURCHGAENGE, {
      modus: 'sequential',
    });
    const { belegung, ohnePlatz } = verteileAufRaumschemata(sitzplaetze, raster);
    expect(ohnePlatz).toHaveLength(0);
    expect(belegung.filter((p) => p.raum === '94/E01 (2. Durchgang)')).toHaveLength(2);
    // Die Nummern laufen über beide Durchgänge weiter – derselbe Tisch hat im
    // zweiten Durchgang eine andere Nummer.
    const nummern = sitzplatznummern(raster, 1001);
    expect(nummern.get('94/E01|0|0')).toBe(1001);
    expect(nummern.get('94/E01 (2. Durchgang)|0|0')).toBe(1003);
  });
});
